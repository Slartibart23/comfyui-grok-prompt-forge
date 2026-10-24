"""
Offline tests (no API key, no network, no ComfyUI). Run from the pack folder with
ComfyUI's Python, which has numpy and Pillow:

    python -m unittest discover -s tests -v
"""

import importlib.util
import json
import os
import shutil
import sys
import tempfile
import types
import unittest
from unittest import mock

import numpy as np

PACK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = tempfile.mkdtemp(prefix="grok_forge_test_")


def _install_stubs():
    fp = types.ModuleType("folder_paths")
    fp.base_path = TMP
    os.makedirs(os.path.join(TMP, "user"), exist_ok=True)
    fp.get_user_directory = lambda: os.path.join(TMP, "user")
    sys.modules["folder_paths"] = fp


def _load_pack():
    os.environ.pop("XAI_API_KEY", None)
    spec = importlib.util.spec_from_file_location(
        "grokpack", os.path.join(PACK, "__init__.py"), submodule_search_locations=[PACK])
    pack = importlib.util.module_from_spec(spec)
    sys.modules["grokpack"] = pack
    with mock.patch("requests.get", side_effect=RuntimeError("no network in tests")):
        spec.loader.exec_module(pack)
    return pack


_install_stubs()
PACK_MODULE = _load_pack()
from grokpack.grok_forge import api, builtin_presets, forge_node, models, presets  # noqa: E402


def tearDownModule():
    shutil.rmtree(TMP, ignore_errors=True)


class FakeResponse:
    def __init__(self, status, body):
        self.status_code = status
        self._body = body
        self.text = json.dumps(body)

    def json(self):
        return self._body


def ok(content, finish="stop"):
    return FakeResponse(200, {
        "choices": [{"message": {"content": content}, "finish_reason": finish}],
        "usage": {"total_tokens": 42, "completion_tokens_details": {"reasoning_tokens": 30}},
    })


class BuiltinPresetTests(unittest.TestCase):
    def test_every_preset_is_complete(self):
        for name, p in builtin_presets.BUILTIN.items():
            with self.subTest(name=name):
                for field in presets.FIELDS:
                    self.assertIn(field, p)
                self.assertEqual(presets.clean(p), {k: p[k] for k in presets.FIELDS})
                self.assertGreaterEqual(p["max_tokens"], 2048, "reasoning needs room")

    def test_default_preset_exists(self):
        self.assertIn(builtin_presets.DEFAULT_PRESET, builtin_presets.BUILTIN)

    def test_all_requested_targets_present(self):
        names = " ".join(builtin_presets.BUILTIN)
        for target in ("Krea 2", "Qwen-Image 2.1", "Qwen-Image-Edit 2.1", "Z-Image", "FLUX",
                       "Illustrious", "Pony", "SDXL", "Wan 2.2", "Wan 2.7", "Wan 3.0",
                       "MiniMax H3 FL2VA", "MiniMax H3 REF2VA"):
            self.assertIn(f"Idea ▸ {target}", names)
            self.assertIn(f"Caption ▸ {target}", names)
        self.assertIn("Caption ▸ LoRA training caption", names)
        self.assertIn("Caption ▸ Describe image", names)

    def test_everything_neutral(self):
        text = json.dumps(builtin_presets.BUILTIN).lower()
        self.assertNotIn("m3l4nie", text)
        self.assertNotIn("melanie", text)

    def test_output_always_english(self):
        for name, p in builtin_presets.BUILTIN.items():
            if p["system_prompt"]:
                self.assertIn("English", p["system_prompt"], name)


class PresetStoreTests(unittest.TestCase):
    def setUp(self):
        path = os.path.join(api.user_dir(), "presets.json")
        if os.path.exists(path):
            os.remove(path)

    def test_save_list_delete_user_preset(self):
        presets.save("My Flux", {"system_prompt": "X", "temperature": 5, "max_tokens": "3000",
                                 "bogus": 1})
        p = presets.get("My Flux")
        self.assertEqual(p["system_prompt"], "X")
        self.assertEqual(p["temperature"], 2.0)  # clamped
        self.assertEqual(p["max_tokens"], 3000)
        self.assertNotIn("bogus", p)
        self.assertFalse(p["builtin"])
        self.assertEqual(presets.names()[-1], "My Flux")
        self.assertTrue(presets.delete("My Flux"))
        self.assertIsNone(presets.get("My Flux"))
        self.assertFalse(presets.delete("My Flux"))

    def test_override_and_restore_builtin(self):
        name = builtin_presets.DEFAULT_PRESET
        original = builtin_presets.BUILTIN[name]["system_prompt"]
        presets.save(name, {"system_prompt": "mine"})
        p = presets.get(name)
        self.assertTrue(p["builtin"] and p["overridden"])
        self.assertEqual(p["system_prompt"], "mine")
        self.assertEqual(p["temperature"], builtin_presets.BUILTIN[name]["temperature"])
        self.assertEqual(presets.names().count(name), 1)
        presets.delete(name)
        self.assertEqual(presets.get(name)["system_prompt"], original)

    def test_empty_name_rejected(self):
        with self.assertRaises(ValueError):
            presets.save("  ", {})

    def test_broken_file_is_ignored(self):
        with open(os.path.join(api.user_dir(), "presets.json"), "w") as f:
            f.write("{nope")
        self.assertEqual(len(presets.names()), len(builtin_presets.BUILTIN))


class ForgeNodeTests(unittest.TestCase):
    def setUp(self):
        self.node = forge_node.GrokPromptForge()
        self.base = dict(preset=builtin_presets.DEFAULT_PRESET, text="eine Katze im Regen",
                         system_prompt="SYS {trigger}", negative_prompt="NEG",
                         model=api.DEFAULT_MODEL, temperature=0.9, top_p=0.95,
                         max_tokens=4096, api_key="test-key")

    def run_node(self, response=None, **kw):
        args = dict(self.base, **kw)
        with mock.patch("requests.post", return_value=response or ok("a cat in the rain")) as post:
            out = self.node.forge(**args)
        return out, post

    def test_basic_request(self):
        out, post = self.run_node()
        self.assertEqual(out, ("a cat in the rain", "NEG"))
        payload = post.call_args.kwargs["json"]
        self.assertEqual(payload["model"], "grok-4.20-0309-reasoning")
        self.assertEqual(payload["top_p"], 0.95)
        self.assertNotIn("presence_penalty", payload)
        self.assertEqual(payload["messages"][0]["content"], "SYS (none)")
        self.assertEqual(payload["messages"][1]["content"], "eine Katze im Regen")

    def test_custom_system_prompt_wins_and_trigger(self):
        _, post = self.run_node(custom_system_prompt="CUSTOM {trigger}", trigger_word="ohwx")
        self.assertEqual(post.call_args.kwargs["json"]["messages"][0]["content"], "CUSTOM ohwx")

    def test_empty_custom_prompt_is_ignored(self):
        _, post = self.run_node(custom_system_prompt="   ")
        self.assertTrue(post.call_args.kwargs["json"]["messages"][0]["content"].startswith("SYS"))

    def test_top_p_one_not_sent(self):
        _, post = self.run_node(top_p=1.0)
        self.assertNotIn("top_p", post.call_args.kwargs["json"])

    def test_images_keep_slot_numbers(self):
        img = np.zeros((2, 8, 8, 3), dtype=np.float32)
        _, post = self.run_node(image_1=img, image_3=img)
        content = post.call_args.kwargs["json"]["messages"][1]["content"]
        texts = [c["text"] for c in content if c["type"] == "text"]
        self.assertEqual(texts[0], "Attached images: Image 1, Image 3.")
        self.assertIn("Image 3:", texts)
        self.assertEqual(sum(c["type"] == "image_url" for c in content), 2)
        self.assertTrue(texts[-1].endswith("eine Katze im Regen"))

    def test_image_without_text(self):
        img = np.zeros((1, 8, 8, 3), dtype=np.float32)
        out, post = self.run_node(text="", image_1=img)
        self.assertEqual(out[0], "a cat in the rain")
        content = post.call_args.kwargs["json"]["messages"][1]["content"]
        self.assertIn("no text", content[-1]["text"])

    def test_nothing_to_do(self):
        out, post = self.run_node(text="  ")
        self.assertEqual(out, ("", "NEG"))
        post.assert_not_called()

    def test_fallback_on_error(self):
        out, _ = self.run_node(response=FakeResponse(403, {"error": "no"}))
        self.assertEqual(out, ("eine Katze im Regen", "NEG"))
        with self.assertRaises(RuntimeError):
            self.run_node(response=FakeResponse(403, {"error": "no"}), fallback_to_input=False)

    def test_reasoning_used_up_max_tokens(self):
        with self.assertRaisesRegex(RuntimeError, "Raise max_tokens"):
            self.run_node(response=ok("", finish="length"), fallback_to_input=False)

    def test_rejected_param_is_stripped_and_resent(self):
        rejected = FakeResponse(400, {"error": "Model x does not support parameter topP."})
        with mock.patch("requests.post", side_effect=[rejected, ok("fine")]) as post:
            out = self.node.forge(**self.base)
        self.assertEqual(out[0], "fine")
        self.assertNotIn("top_p", post.call_args.kwargs["json"])

    def test_input_types_and_validation(self):
        spec = forge_node.GrokPromptForge.INPUT_TYPES()
        self.assertEqual(spec["required"]["preset"][0], presets.names())
        self.assertEqual(spec["required"]["model"][1]["default"], "grok-4.20-0309-reasoning")
        self.assertEqual(spec["required"]["model"][0][0], "grok-4.20-0309-reasoning")
        for n in (1, 2, 3):
            self.assertEqual(spec["optional"][f"image_{n}"][0], "IMAGE")
        self.assertTrue(forge_node.GrokPromptForge.VALIDATE_INPUTS("unknown", "unknown"))


class ModelListTests(unittest.TestCase):
    def test_refresh_puts_default_first_and_caches(self):
        body = {"models": [{"id": "grok-9"}, {"id": "grok-4.20-0309-reasoning"}, {"id": "grok-1"}]}
        with mock.patch.dict(os.environ, {"XAI_API_KEY": "k"}), \
                mock.patch("requests.get", return_value=FakeResponse(200, body)):
            result = models.refresh()
        self.assertEqual(result, ["grok-4.20-0309-reasoning", "grok-1", "grok-9"])
        with open(os.path.join(api.user_dir(), "models.json")) as f:
            self.assertEqual(json.load(f)["models"], result)
        self.assertEqual(models.model_list(), result)


class LegacyNodeTests(unittest.TestCase):
    def test_legacy_nodes_registered_and_hidden(self):
        for node_id in ("GrokTextRefine", "GrokVisionCaption"):
            cls = PACK_MODULE.NODE_CLASS_MAPPINGS[node_id]
            self.assertTrue(cls.DEPRECATED)
            self.assertEqual(cls.INPUT_TYPES()["required"]["model"][1]["default"],
                             "grok-4.20-0309-reasoning")
        self.assertIn("GrokPromptForge", PACK_MODULE.NODE_CLASS_MAPPINGS)

    def test_legacy_refine_uses_shared_client(self):
        refine = PACK_MODULE.NODE_CLASS_MAPPINGS["GrokTextRefine"]()
        with mock.patch("requests.post", return_value=ok("clean")) as post:
            out = refine.refine("raw", "SYS", "grok-4.20-0309-reasoning", 0.2, 4096,
                                presence_penalty=0.3, api_key="k")
        self.assertEqual(out, ("clean",))
        self.assertEqual(post.call_args.kwargs["json"]["presence_penalty"], 0.3)


if __name__ == "__main__":
    unittest.main()
