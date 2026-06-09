from flask import Flask, render_template, jsonify, request
import json
from pathlib import Path

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
MATERIALS_FILE = BASE_DIR / "materials.json"
SETTINGS_FILE = BASE_DIR / "settings.json"


def read_json(path, fallback):
    if not path.exists():
        write_json(path, fallback)
        return fallback

    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as file:
        json.dump(data, file, indent=4)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/materials", methods=["GET"])
def get_materials():
    materials = read_json(MATERIALS_FILE, {})
    return jsonify(materials)


@app.route("/api/materials", methods=["POST"])
def save_material():
    materials = read_json(MATERIALS_FILE, {})
    data = request.get_json() or {}

    name = str(data.get("name", "")).strip()
    original_name = str(data.get("original_name", "")).strip()

    if not name:
        return jsonify({"error": "Material name is required."}), 400

    try:
        material_data = {
            "category": str(data.get("category", "")).strip(),
            "roll_cost": float(data.get("roll_cost", 0)),
            "roll_width_inches": float(data.get("roll_width_inches", 0)),
            "roll_length_feet": float(data.get("roll_length_feet", 0)),
        }
        if (
            material_data["roll_cost"] < 0
            or material_data["roll_width_inches"] < 0
            or material_data["roll_length_feet"] < 0
        ):
            return jsonify({"error": "Material numbers cannot be negative."}), 400
    except ValueError:
        return jsonify({"error": "Material numbers must be valid."}), 400

    # If editing an existing material and the name changed, remove the old key first.
    if original_name and original_name in materials and original_name != name:
        del materials[original_name]

    materials[name] = material_data

    write_json(MATERIALS_FILE, materials)
    return jsonify({"success": True, "materials": materials})


@app.route("/api/materials/<path:name>", methods=["DELETE"])
def delete_material(name):
    materials = read_json(MATERIALS_FILE, {})

    if name not in materials:
        return jsonify({"error": "Material not found."}), 404

    del materials[name]
    write_json(MATERIALS_FILE, materials)

    return jsonify({"success": True, "materials": materials})


@app.route("/api/settings", methods=["GET"])
def get_settings():
    settings = read_json(
        SETTINGS_FILE, {"laminate_addon_per_sqft": 13, "cut_addon_per_sqft": 8.5}
    )

    return jsonify(settings)


@app.route("/api/settings", methods=["POST"])
def save_settings():
    data = request.get_json() or {}

    try:
        settings = {
            "laminate_addon_per_sqft": float(data.get("laminate_addon_per_sqft", 13)),
            "cut_addon_per_sqft": float(data.get("cut_addon_per_sqft", 8.5)),
        }
        if (
            settings["laminate_addon_per_sqft"] < 0
            or settings["cut_addon_per_sqft"] < 0
        ):
            return jsonify({"error": "Settings cannot be negative."}), 400
    except ValueError:
        return jsonify({"error": "Settings must be valid numbers."}), 400

    write_json(SETTINGS_FILE, settings)

    return jsonify({"success": True, "settings": settings})


if __name__ == "__main__":
    app.run(debug=True)
