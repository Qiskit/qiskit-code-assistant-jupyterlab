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
from pathlib import Path

import requests
import tornado
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from qiskit_ibm_runtime import QiskitRuntimeService

runtime_configs = {"service_url": "http://localhost", "api_token": ""}


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
            token = config.get("default-ibm-quantum", {}).get("token", "")

    runtime_configs["api_token"] = token


def get_header():
    return {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Caller": "qiskit-code-assistant-jupyterlab",
        "Authorization": f"Bearer {runtime_configs['api_token']}",
    }


class ServiceUrlHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"url": runtime_configs["service_url"]}))

    @tornado.web.authenticated
    def post(self):
        json_payload = self.get_json_body()

        runtime_configs["service_url"] = json_payload["url"]

        self.finish(json.dumps({"url": runtime_configs["service_url"]}))


class TokenHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"success": (runtime_configs["api_token"] != "")}))

    @tornado.web.authenticated
    def post(self):
        json_payload = self.get_json_body()

        update_token(json_payload["token"])

        self.finish(json.dumps({"success": "true"}))


class ModelsHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
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
    def post(self, id):
        url = url_path_join(runtime_configs["service_url"], "model", id, "prompt")

        try:
            r = requests.post(url, headers=get_header(), json=self.get_json_body())
            r.raise_for_status()
        except requests.exceptions.HTTPError as err:
            self.set_status(err.response.status_code)
            self.finish(json.dumps(err.response.json()))
        else:
            self.finish(json.dumps(r.json()))


class PromptAcceptanceHandler(APIHandler):
    @tornado.web.authenticated
    def post(self, id):
        url = url_path_join(runtime_configs["service_url"], "prompt", id, "acceptance")

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
    id_regex = r"(?P<id>[\w\-]+)"
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
    ]
    web_app.add_handlers(host_pattern, handlers)
    init_token()
