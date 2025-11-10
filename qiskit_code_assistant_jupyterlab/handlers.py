#
# Copyright 2024 IBM Corporation
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Callable

import requests
import tornado
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from qiskit_ibm_runtime import QiskitRuntimeService

OPENAI_VERSION = "v1"
STREAM_DATA_PREFIX = "data: "

runtime_configs = {
    "service_url": "http://localhost",
    "api_token": "",
    "is_openai": False,
    "selected_credential": None,
    "using_env_var": False,  # Track if env var is overriding selection
}


def update_token(token):
    if token:
        runtime_configs["api_token"] = token
        # When manually setting token, update selected credential to match
        runtime_configs["selected_credential"] = "qiskit-code-assistant"
        # Save to both qiskit-ibm.json and preferences
        try:
            QiskitRuntimeService.save_account(
                channel="ibm_quantum_platform",
                name="qiskit-code-assistant",
                token=token,
                overwrite=True,
            )
            save_selected_credential("qiskit-code-assistant")
            print("Manually entered token saved as 'qiskit-code-assistant' credential")
        except Exception as e:
            print(f"Error saving token: {e}")
            # Still keep the token in runtime_configs so it can be used this session
            # Even if saving to file fails


def get_preference_file_path():
    """Get path to the code assistant preference file."""
    return Path.home() / ".qiskit" / "qiskit-code-assistant-prefs.json"


def load_preferences():
    """Load all preferences from preference file."""
    pref_file = get_preference_file_path()
    if not os.path.exists(pref_file):
        return {}

    try:
        with open(pref_file) as f:
            prefs = json.load(f)
        return prefs
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading preference file: {e}")
        return {}


def load_selected_credential():
    """Load the previously selected credential from preference file."""
    prefs = load_preferences()
    return prefs.get("selected_credential")


def save_preferences(updates):
    """Save preferences to file. updates is a dict of key-value pairs to update."""
    pref_file = get_preference_file_path()

    # Ensure .qiskit directory exists
    pref_file.parent.mkdir(parents=True, exist_ok=True)

    try:
        # Load existing preferences
        prefs = load_preferences()

        # Update with new values
        prefs.update(updates)

        # Save back to file
        with open(pref_file, "w") as f:
            json.dump(prefs, f, indent=2)

        print(f"Saved preferences: {updates}")
    except IOError as e:
        print(f"Error saving preference file: {e}")


def save_selected_credential(credential_name):
    """Save the selected credential to preference file for persistence."""
    save_preferences({"selected_credential": credential_name})


def get_never_prompt_flag():
    """Get the global 'never prompt' flag."""
    prefs = load_preferences()
    return prefs.get("never_prompt_credential_selection", False)


def set_never_prompt_flag(value):
    """Set the global 'never prompt' flag."""
    save_preferences({"never_prompt_credential_selection": value})


def get_has_prompted_flag():
    """Get the 'has prompted in this session' flag."""
    prefs = load_preferences()
    return prefs.get("has_prompted_credential_selection", False)


def set_has_prompted_flag(value):
    """Set the 'has prompted in this session' flag."""
    save_preferences({"has_prompted_credential_selection": value})


def get_credentials_from_config():
    """
    Read all credentials from qiskit-ibm.json file.
    Returns a dict of {credential_name: credential_data}

    Users can have credentials with ANY names in their qiskit-ibm.json file.
    Common examples include:
    - "qiskit-code-assistant"
    - "default-ibm-quantum-platform"
    - "default-ibm-quantum"
    - "my-work-account"
    - "personal-account"
    Or any other custom name they choose.
    """
    path = Path.home() / ".qiskit" / "qiskit-ibm.json"

    if not os.path.exists(path):
        return {}

    try:
        with open(path) as f:
            config = json.load(f)

        # Filter out entries that have tokens
        # This returns ALL credential entries regardless of their names
        # Only include credentials with non-empty tokens
        credentials = {
            name: data for name, data in config.items()
            if isinstance(data, dict) and data.get("token", "").strip()
        }
        return credentials
    except (json.JSONDecodeError, IOError) as e:
        print(f"Error reading credentials file: {e}")
        return {}


def init_token():
    token = os.environ.get("QISKIT_IBM_TOKEN")

    if token:
        # Environment variable takes precedence
        runtime_configs["using_env_var"] = True
        print("Using token from QISKIT_IBM_TOKEN environment variable")
    else:
        runtime_configs["using_env_var"] = False
        credentials = get_credentials_from_config()

        # Try to restore previously selected credential from preferences
        if not runtime_configs["selected_credential"]:
            saved_credential = load_selected_credential()
            if saved_credential and saved_credential in credentials:
                runtime_configs["selected_credential"] = saved_credential
                print(f"Restored previously selected credential: {saved_credential}")

        # If a specific credential is selected, use it
        if runtime_configs["selected_credential"] and runtime_configs["selected_credential"] in credentials:
            token = credentials[runtime_configs["selected_credential"]].get("token")
        else:
            # Only auto-select if there's exactly one credential
            # If multiple credentials exist, leave token empty so frontend can prompt user
            if len(credentials) == 1:
                # Auto-select the only credential
                single_cred_name = next(iter(credentials.keys()))
                token = credentials[single_cred_name].get("token")
                runtime_configs["selected_credential"] = single_cred_name
                print(f"Auto-selected single credential: {single_cred_name}")
            elif len(credentials) > 1:
                # Multiple credentials exist - don't auto-select, let frontend prompt user
                print(f"Found {len(credentials)} credentials, waiting for user selection")
                token = None
            else:
                # No credentials
                print("No credentials found in qiskit-ibm.json")
                token = None

    runtime_configs["api_token"] = token


def get_header():
    header = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Caller": "qiskit-code-assistant-jupyterlab",
    }
    if not runtime_configs["is_openai"]:
        header["Authorization"] = f"Bearer {runtime_configs['api_token']}"
    return header


def convert_openai(model):
    return {
        "_id": model["id"],
        "disclaimer": {"accepted": "true"},
        "display_name": model["id"],
        "doc_link": "",
        "license": {"name": "", "link": ""},
        "model_id": model["id"],
        "prompt_type": 1,
        "token_limit": 255
    }


class ServiceUrlHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "url": runtime_configs["service_url"],
            "is_openai": runtime_configs["is_openai"]
            }))

    @tornado.web.authenticated
    def post(self):
        json_payload = self.get_json_body()

        runtime_configs["service_url"] = json_payload["url"]

        try:
            r = requests.get(url_path_join(runtime_configs["service_url"]), headers=get_header())
            runtime_configs["is_openai"] = (r.json()["name"] != "qiskit-code-assistant")
        except (requests.exceptions.JSONDecodeError, KeyError):
            runtime_configs["is_openai"] = True
        finally:
            self.finish(json.dumps({
                "url": runtime_configs["service_url"],
                "is_openai": runtime_configs["is_openai"]
                }))


class TokenHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"success": (runtime_configs["api_token"] != ""
                                            or runtime_configs["is_openai"])}))

    @tornado.web.authenticated
    def post(self):
        json_payload = self.get_json_body()

        update_token(json_payload["token"])

        self.finish(json.dumps({"success": "true"}))


class ModelsHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        if runtime_configs["is_openai"]:
            url = url_path_join(runtime_configs["service_url"], OPENAI_VERSION, "models")
            models = []
            try:
                r = requests.get(url, headers=get_header())
                r.raise_for_status()

                if r.ok:
                    data = r.json()["data"]
                    models = list(map(convert_openai, data))
            except requests.exceptions.HTTPError as err:
                self.set_status(err.response.status_code)
                self.finish(json.dumps(err.response.json()))
            else:
                self.finish(json.dumps({"models": models}))
        else:
            url = url_path_join(runtime_configs["service_url"], "models")

            try:
                r = requests.get(url, headers=get_header())
                r.raise_for_status()
            except requests.exceptions.HTTPError as err:
                self.set_status(err.response.status_code)
                self.finish(json.dumps(err.response.json()))
            else:
                self.finish(json.dumps(r.json()))


class ModelHandler(APIHandler):
    @tornado.web.authenticated
    def get(self, id):
        if runtime_configs["is_openai"]:
            url = url_path_join(runtime_configs["service_url"], OPENAI_VERSION, "models", id)
            model = {}
            try:
                r = requests.get(url, headers=get_header())
                r.raise_for_status()

                if r.ok:
                    model = convert_openai(r.json())
            except requests.exceptions.HTTPError as err:
                self.set_status(err.response.status_code)
                self.finish(json.dumps(err.response.json()))
            else:
                self.finish(json.dumps(model))
        else:
            url = url_path_join(runtime_configs["service_url"], "model", id)

            try:
                r = requests.get(url, headers=get_header())
                r.raise_for_status()
            except requests.exceptions.HTTPError as err:
                self.set_status(err.response.status_code)
                self.finish(json.dumps(err.response.json()))
            else:
                self.finish(json.dumps(r.json()))


class DisclaimerHandler(APIHandler):
    @tornado.web.authenticated
    def get(self, id):
        if runtime_configs["is_openai"]:
            self.finish(json.dumps({"accepted": "true"}))
        else:
            url = url_path_join(runtime_configs["service_url"], "model", id, "disclaimer")

            try:
                r = requests.get(url, headers=get_header())
                r.raise_for_status()
            except requests.exceptions.HTTPError as err:
                self.set_status(err.response.status_code)
                self.finish(json.dumps(err.response.json()))
            else:
                self.finish(json.dumps(r.json()))


class DisclaimerAcceptanceHandler(APIHandler):
    @tornado.web.authenticated
    def post(self, id):
        if runtime_configs["is_openai"]:
            self.finish(json.dumps({"success": "true"}))
        else:
            url = url_path_join(
                runtime_configs["service_url"], "disclaimer", id, "acceptance"
            )

            try:
                r = requests.post(url, headers=get_header(), json=self.get_json_body())
                r.raise_for_status()
            except requests.exceptions.HTTPError as err:
                self.set_status(err.response.status_code)
                self.finish(json.dumps(err.response.json()))
            else:
                self.finish(json.dumps(r.json()))


class PromptHandler(APIHandler):
    @tornado.web.authenticated
    @tornado.gen.coroutine
    def post(self, id):
        request_body = self.get_json_body()
        is_stream = request_body.get("stream", False)
        is_openai = runtime_configs.get("is_openai", False)

        if is_openai:
            url = url_path_join(runtime_configs["service_url"], OPENAI_VERSION, "completions")
            request_body = {
                "model": id,
                "prompt": request_body["input"],
                "stream": is_stream
            }
        else:
            url = url_path_join(runtime_configs["service_url"], "model", id, "prompt")

        def _on_chunk(chunk: bytes):
            try:
                if is_openai:
                    # Parse chunk - returns list of parsed SSE messages
                    parsed_chunks = parse_streaming_chunk(chunk)
                    if parsed_chunks:  # Check if we got any valid parsed chunks
                        for parsed_chunk in parsed_chunks:
                            # Convert each parsed chunk to our response format
                            response = to_model_prompt_response(parsed_chunk)
                            self.write(STREAM_DATA_PREFIX + json.dumps(response) + "\n")
                        self.flush()
                else:
                    self.write(chunk)
                    self.flush()
            except Exception as e:
                # Log error but continue streaming
                print(f"Error processing chunk: {e}")
                # Send error to client
                error_msg = {"error": str(e), "type": "chunk_processing_error"}
                self.write(STREAM_DATA_PREFIX + json.dumps(error_msg) + "\n")
                self.flush()

        try:
            if is_stream:
                yield make_streaming_request(url, json.dumps(request_body), _on_chunk)
            else:
                non_streaming_response = make_non_streaming_request(url, request_body)
                result = to_model_prompt_response(non_streaming_response) if is_openai else non_streaming_response
        except requests.exceptions.HTTPError as err:
            self.set_status(err.response.status_code)
            try:
                self.finish(json.dumps(err.response.json()))
            except Exception:
                self.finish(json.dumps({"error": "Request failed", "status": err.response.status_code}))
        except Exception as e:
            # Handle other errors (timeouts, connection errors, etc.)
            print(f"Error in prompt handler: {e}")
            self.set_status(500)
            self.finish(json.dumps({"error": str(e), "type": "server_error"}))
        else:
            if is_stream:
                self.finish()
            else:
                self.finish(json.dumps(result))


class PromptAcceptanceHandler(APIHandler):
    @tornado.web.authenticated
    def post(self, id):
        if runtime_configs["is_openai"]:
            self.finish(json.dumps({"success": "true"}))
        else:
            url = url_path_join(runtime_configs["service_url"], "prompt", id, "acceptance")

            try:
                r = requests.post(url, headers=get_header(), json=self.get_json_body())
                r.raise_for_status()
            except requests.exceptions.HTTPError as err:
                self.set_status(err.response.status_code)
                self.finish(json.dumps(err.response.json()))
            else:
                self.finish(json.dumps(r.json()))


class FeedbackHandler(APIHandler):
    @tornado.web.authenticated
    def post(self):
        if runtime_configs["is_openai"]:
            self.finish(json.dumps({"message": "Feedback not supported for this service"}))
        else:
            url = url_path_join(runtime_configs["service_url"], "feedback")

            try:
                r = requests.post(url, headers=get_header(), json=self.get_json_body())
                r.raise_for_status()
            except requests.exceptions.HTTPError as err:
                self.set_status(err.response.status_code)
                self.finish(json.dumps(err.response.json()))
            else:
                self.finish(json.dumps(r.json()))


class CredentialsHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        """Get list of available credentials from qiskit-ibm.json"""
        credentials = get_credentials_from_config()

        # Return credential names and selected credential
        credential_list = [
            {
                "name": name,
                "is_selected": name == runtime_configs["selected_credential"]
            }
            for name in credentials.keys()
        ]

        self.finish(json.dumps({
            "credentials": credential_list,
            "selected_credential": runtime_configs["selected_credential"],
            "using_env_var": runtime_configs.get("using_env_var", False),
            "never_prompt": get_never_prompt_flag(),
            "has_prompted": get_has_prompted_flag()
        }))

    @tornado.web.authenticated
    def post(self):
        """Select a credential to use"""
        json_payload = self.get_json_body()
        credential_name = json_payload.get("credential_name")

        if not credential_name:
            self.set_status(400)
            self.finish(json.dumps({"error": "credential_name is required"}))
            return

        credentials = get_credentials_from_config()

        if credential_name not in credentials:
            self.set_status(404)
            self.finish(json.dumps({"error": f"Credential '{credential_name}' not found"}))
            return

        # Validate that the credential has a token
        token = credentials[credential_name].get("token")
        if not token:
            self.set_status(400)
            self.finish(json.dumps({"error": f"Credential '{credential_name}' has no token"}))
            return

        # Set the selected credential and update token
        runtime_configs["selected_credential"] = credential_name
        runtime_configs["api_token"] = token

        # Save selection to preference file for persistence
        save_selected_credential(credential_name)

        self.finish(json.dumps({
            "success": True,
            "selected_credential": credential_name
        }))

    @tornado.web.authenticated
    def put(self):
        """Update credential state flags (never_prompt, has_prompted)"""
        json_payload = self.get_json_body()

        updates = {}
        if "never_prompt" in json_payload:
            set_never_prompt_flag(json_payload["never_prompt"])
            updates["never_prompt"] = json_payload["never_prompt"]

        if "has_prompted" in json_payload:
            set_has_prompted_flag(json_payload["has_prompted"])
            updates["has_prompted"] = json_payload["has_prompted"]

        if not updates:
            self.set_status(400)
            self.finish(json.dumps({"error": "No valid fields to update"}))
            return

        self.finish(json.dumps({
            "success": True,
            "updated": updates
        }))

    @tornado.web.authenticated
    def delete(self):
        """Clear the credential selection and all state flags (reset to default behavior)"""
        # Clear the runtime selection
        runtime_configs["selected_credential"] = None

        # Delete the preference file (clears ALL state)
        pref_file = get_preference_file_path()
        if os.path.exists(pref_file):
            try:
                os.remove(pref_file)
                print("Cleared all credential preferences and state flags")
            except IOError as e:
                print(f"Error deleting preference file: {e}")
                self.set_status(500)
                self.finish(json.dumps({"error": f"Failed to delete preference file: {e}"}))
                return

        # Re-initialize token to use default selection logic
        init_token()

        self.finish(json.dumps({
            "success": True,
            "message": "Credential selection and all preferences have been reset. You'll be prompted again on next restart if multiple credentials exist."
        }))


def setup_handlers(web_app):
    host_pattern = ".*$"
    id_regex = r"(?P<id>[\w\-\_\.\:]+)"  # valid chars: alphanum | "-" | "_" | "." | ":"
    base_url = url_path_join(web_app.settings["base_url"], "qiskit-code-assistant")

    handlers = [
        (f"{base_url}/service", ServiceUrlHandler),
        (f"{base_url}/token", TokenHandler),
        (f"{base_url}/credentials", CredentialsHandler),
        (f"{base_url}/models", ModelsHandler),
        (f"{base_url}/model/{id_regex}", ModelHandler),
        (f"{base_url}/model/{id_regex}/disclaimer", DisclaimerHandler),
        (f"{base_url}/disclaimer/{id_regex}/acceptance", DisclaimerAcceptanceHandler),
        (f"{base_url}/model/{id_regex}/prompt", PromptHandler),
        (f"{base_url}/prompt/{id_regex}/acceptance", PromptAcceptanceHandler),
        (f"{base_url}/feedback", FeedbackHandler),
    ]
    web_app.add_handlers(host_pattern, handlers)
    init_token()


def make_non_streaming_request(url: str, json_body: dict, method: str = "POST"):
    r = requests.request(
        method,
        url,
        headers=get_header(),
        json=json_body
    )
    r.raise_for_status()

    if r.ok:
        return r.json()
    return {}


def make_streaming_request(
    url: str, request_body: str, streaming_callback: Callable, method: str = "POST"
) -> tornado.concurrent.Future:
    client = tornado.httpclient.AsyncHTTPClient()
    request = tornado.httpclient.HTTPRequest(
        url,
        method=method,
        headers=get_header(),
        body=request_body,
        streaming_callback=streaming_callback,
        request_timeout=60.0,  # 60 second timeout for streaming requests
        connect_timeout=10.0   # 10 second connection timeout
    )
    return client.fetch(request, raise_error=True)


def to_model_prompt_response(response: dict) -> dict:
    return {
        "results": list(map(lambda c: {"generated_text": c["text"]}, response["choices"])),
        "prompt_id": response["id"],
        "created_at": datetime.fromtimestamp(int(response["created"])).isoformat()
    } if response else {}


def parse_streaming_chunk(chunk: bytes) -> list:
    """
    Parse OpenAI/Ollama SSE streaming chunks.
    Returns a list of parsed JSON objects (can be multiple per chunk).
    Handles 'data: [DONE]' termination marker.
    """
    results = []
    try:
        chunk_str = chunk.decode("utf-8")
        # Split by newlines to handle multiple SSE messages in one chunk
        lines = chunk_str.strip().split('\n')

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Check for [DONE] marker
            if line == "data: [DONE]":
                continue

            # Parse SSE format: "data: {json}"
            if line.startswith(STREAM_DATA_PREFIX):
                json_str = line[len(STREAM_DATA_PREFIX):].strip()
                if json_str and json_str != "[DONE]":
                    try:
                        data = json.loads(json_str)
                        results.append(data)
                    except json.JSONDecodeError as e:
                        print(f"Error parsing JSON in line: {line[:100]}... Error: {e}")
    except UnicodeDecodeError as e:
        print(f"Error decoding chunk: {e}")

    return results
