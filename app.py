from flask import Flask, render_template, jsonify, request
import json
from pathlib import Path

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
MATERIALS_FILE = BASE_DIR / "materials.json"
LAMINATES_FILE = BASE_DIR / "laminations.json"
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


@app.route("/api/laminations", methods=["GET"])
def get_laminations():
    laminations = read_json(LAMINATES_FILE, {})
    return jsonify(laminations)


@app.route("/api/laminations", methods=["POST"])
def save_lamination():
    laminations = read_json(LAMINATES_FILE, {})
    data = request.get_json() or {}

    name = str(data.get("name", "")).strip()
    original_name = str(data.get("original_name", "")).strip()

    if not name:
        return jsonify({"error": "Lamination name is required."}), 400

    try:
        lamination_data = {
            "category": str(data.get("category", "")).strip(),
            "roll_cost": float(data.get("roll_cost", 0)),
            "roll_width_inches": float(data.get("roll_width_inches", 0)),
            "roll_length_feet": float(data.get("roll_length_feet", 0)),
        }
        if (
            lamination_data["roll_cost"] < 0
            or lamination_data["roll_width_inches"] < 0
            or lamination_data["roll_length_feet"] < 0
        ):
            return jsonify({"error": "Lamination numbers cannot be negative."}), 400
    except ValueError:
        return jsonify({"error": "Lamination numbers must be valid."}), 400

    if original_name and original_name in laminations and original_name != name:
        del laminations[original_name]

    laminations[name] = lamination_data
    write_json(LAMINATES_FILE, laminations)

    return jsonify({"success": True, "laminations": laminations})


@app.route("/api/laminations/<path:name>", methods=["DELETE"])
def delete_lamination(name):
    laminations = read_json(LAMINATES_FILE, {})

    if name not in laminations:
        return jsonify({"error": "Lamination not found."}), 404

    del laminations[name]
    write_json(LAMINATES_FILE, laminations)

    return jsonify({"success": True, "laminations": laminations})


@app.route("/api/settings", methods=["GET"])
def get_settings():
    default_settings = {
        "cut_addon_per_sqft": 8.5,
        "markup_presets": [
            {"name": "Conservative", "multiplier": 2},
            {"name": "Standard", "multiplier": 3}
        ]
    }

    settings = read_json(SETTINGS_FILE, default_settings)
    if not isinstance(settings, dict):
        settings = default_settings

    if "cut_addon_per_sqft" not in settings or not isinstance(settings["cut_addon_per_sqft"], (int, float)):
        settings["cut_addon_per_sqft"] = default_settings["cut_addon_per_sqft"]

    if (
        "markup_presets" not in settings
        or not isinstance(settings["markup_presets"], list)
        or not settings["markup_presets"]
    ):
        settings["markup_presets"] = default_settings["markup_presets"]

    return jsonify({
        "cut_addon_per_sqft": float(settings["cut_addon_per_sqft"]),
        "markup_presets": [
            {
                "name": str(item.get("name", "")).strip() or default_settings["markup_presets"][0]["name"],
                "multiplier": float(item.get("multiplier", 1))
            }
            for item in settings["markup_presets"]
        ]
    })


@app.route("/api/settings", methods=["POST"])
def save_settings():
    data = request.get_json() or {}

    try:
        cut_rate = float(data.get("cut_addon_per_sqft", 8.5))
        markup_presets = data.get("markup_presets", [])

        if cut_rate < 0:
            raise ValueError("Cut rate cannot be negative.")

        if not isinstance(markup_presets, list) or not markup_presets:
            raise ValueError("Markup presets must be a non-empty list.")

        parsed_presets = []
        for preset in markup_presets:
            name = str(preset.get("name", "")).strip()
            multiplier = float(preset.get("multiplier", 0))
            if not name or multiplier <= 0:
                raise ValueError("Each markup preset must have a valid name and multiplier.")
            parsed_presets.append({"name": name, "multiplier": multiplier})

        settings = {
            "cut_addon_per_sqft": cut_rate,
            "markup_presets": parsed_presets
        }
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    write_json(SETTINGS_FILE, settings)
    return jsonify({"success": True, "settings": settings})


if __name__ == "__main__":
    app.run(debug=True)
