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
}


def update_token(token):
    if token:
        runtime_configs["api_token"] = token
        QiskitRuntimeService.save_account(
            channel="ibm_quantum",
            name="qiskit-code-assistant",
            token=token,
            overwrite=True,
        )


def init_token():
    token = os.environ.get("QISKIT_IBM_TOKEN")

    path = Path.home() / ".qiskit" / "qiskit-ibm.json"

    if not token and os.path.exists(path):
        with open(path) as f:
            config = json.load(f)
        token = config.get("qiskit-code-assistant", {}).get("token")

        if not token:
            token = config.get("default-ibm-quantum-platform", {}).get("token", "")

        if not token:
            token = config.get("default-ibm-quantum", {}).get("token", "")

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
                "prompt": request_body["input"]
            }
        else:
            url = url_path_join(runtime_configs["service_url"], "model", id, "prompt")

        def _on_chunk(chunk: bytes):
            if is_openai:
                parsed_chunk = parse_streaming_chunk(chunk)
                response = to_model_prompt_response(parsed_chunk)
                self.write(STREAM_DATA_PREFIX + json.dumps(response))
            else:
                self.write(chunk)
            self.flush()

        try:
            if is_stream:
                yield make_streaming_request(url, json.dumps(request_body), _on_chunk)
            else:
                parsed_chunk = make_non_streaming_request(url, request_body)
                result = to_model_prompt_response(parsed_chunk) if is_openai else parsed_chunk
        except requests.exceptions.HTTPError as err:
            self.set_status(err.response.status_code)
            self.finish(json.dumps(err.response.json()))
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


def setup_handlers(web_app):
    host_pattern = ".*$"
    id_regex = r"(?P<id>[\w\-\_\.\:]+)"  # valid chars: alphanum | "-" | "_" | "." | ":"
    base_url = url_path_join(web_app.settings["base_url"], "qiskit-code-assistant")

    handlers = [
        (f"{base_url}/service", ServiceUrlHandler),
        (f"{base_url}/token", TokenHandler),
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
        streaming_callback=streaming_callback
    )
    return client.fetch(request, raise_error=True)


def to_model_prompt_response(response: dict) -> dict:
    return {
        "results": list(map(lambda c: {"generated_text": c["text"]}, response["choices"])),
        "prompt_id": response["id"],
        "created_at": datetime.fromtimestamp(int(response["created"])).isoformat()
    } if response else {}


def parse_streaming_chunk(chunk: bytes) -> dict:
    chunk_str = chunk.decode("utf-8")
    if chunk_str.startswith(STREAM_DATA_PREFIX):
        data = json.loads(chunk_str[len(STREAM_DATA_PREFIX):])
        return data
