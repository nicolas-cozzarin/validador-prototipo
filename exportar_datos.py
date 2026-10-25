"""Genera datos.json para la vista estática con una ejecución real del validador.

Corre los mismos pasos que el pipeline del Banco Aurora (train.py, measure y
check) para v1 y v2 contra un GraphDB local, valida a mano las dos fichas de
ejemplo y guarda todo lo que muestra la pantalla.

Necesita los repos validador y banco-aurora-modelo-credito al lado de esta
carpeta, el validador instalado y un GraphDB local con el repositorio historial.

Uso:  python exportar_datos.py
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

from validador import graphdb, queries
from validador.fairness import measure, to_turtle
from validador.rules import decimal_es, load_rules, parity_threshold, rules_version
from validador.service import validate_ficha

AQUI = Path(__file__).resolve().parent
VALIDADOR = AQUI.parent / "validador"
BANCO = AQUI.parent / "banco-aurora-modelo-credito"


def vaciar_historial():
    # Este script borra el repositorio historial, por eso solo se usa con un GraphDB local.
    if not graphdb.url().startswith(("http://localhost", "http://127.0.0.1")):
        sys.exit("Usá un GraphDB local: este script vacía el repositorio historial.")
    requests.delete(f"{graphdb.url()}/repositories/historial/statements", timeout=60).raise_for_status()


def validacion_manual(nombre):
    r = validate_ficha((VALIDADOR / "examples" / nombre).read_text(encoding="utf-8"), origin="manual")
    return {
        "model_name": r["model_name"], "version_label": r["version_label"], "rules_version": r["rules_version"],
        "conforms": r["conforms"], "failed_rules": r["failed_rules"],
        "reglas": [{"id": o["id"], "ok": o["conforms"], "observed": o["observed"], "expected": o["expected"]}
                   for o in r["outcomes"]],
    }


def pipeline_del_banco(version):
    """train.py, measure y check, como los jobs del pipeline."""
    with tempfile.TemporaryDirectory() as carpeta:
        carpeta = Path(carpeta)
        shutil.copy(BANCO / "train.py", carpeta)
        ficha = (BANCO / "ficha.ttl").read_text(encoding="utf-8").replace(
            'ct:versionLabel "v1"', f'ct:versionLabel "{version}"')
        (carpeta / "ficha.ttl").write_text(ficha, encoding="utf-8")
        subprocess.run([sys.executable, "train.py"], cwd=carpeta, check=True, capture_output=True)
        medicion = to_turtle(measure(pd.read_csv(carpeta / "outputs" / "predictions.csv")))
        r = validate_ficha(ficha, medicion, origin="pipeline")
        print(f"Pipeline {version}: {'conforme' if r['conforms'] else 'no conforme'}")


def main():
    vaciar_historial()
    manual = {nombre: validacion_manual(nombre) for nombre in ("ficha-v1.ttl", "ficha-v2.ttl")}

    vaciar_historial()
    for version in ("v1", "v2"):
        pipeline_del_banco(version)

    ejecuciones = []
    for run in queries.runs():
        run["reglas"] = [{"id": r["rule"].split("#")[-1], "ok": r["outcome"].endswith("#Conformant"),
                          "observed": r["observed"], "expected": r["expected"]}
                         for r in queries.rule_results(run["run"])]
        run["tasas"] = queries.group_rates(run["version"])
        run["reporte"] = queries.report_turtle(run["run"])
        ejecuciones.append(run)

    historial = {}
    for clave in {(r["clientId"], r["modelId"]) for r in ejecuciones}:
        consulta = queries.history_query(*clave)
        historial["|".join(clave)] = {"consulta": consulta.strip(), "filas": graphdb.select(consulta)}

    datos = {
        "generado": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "graphdb": os.environ.get("GRAPHDB_VERSION", "GraphDB 10.8.14"),
        "rulesVersion": rules_version(),
        "umbral": float(parity_threshold()),
        "umbralTexto": "≤ " + decimal_es(parity_threshold()),
        "reglas": [{k: r[k] for k in ("id", "label", "legal_basis", "url")} for r in load_rules()],
        "ejecuciones": ejecuciones,
        "historial": historial,
        "manual": manual,
    }
    (AQUI / "datos.json").write_text(json.dumps(datos, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"datos.json listo: {len(ejecuciones)} ejecuciones del pipeline y 2 validaciones manuales")


if __name__ == "__main__":
    main()
