"""
Tests unitarios de core/storage.py — no requieren MinIO corriendo.
Verifica la construcción del cliente y el reemplazo de hostname interno.
"""
import os
from unittest.mock import MagicMock, patch

import pytest

from app.core.storage import StorageClient, get_storage_client


# ── StorageClient.generate_presigned_url ─────────────────────────────────────

class TestGeneratePresignedUrl:
    def _make_client(self, public_url: str | None = None) -> StorageClient:
        with patch("app.core.storage.boto3.client"):
            client = StorageClient(
                endpoint_url="http://minio:9000",
                access_key="minioadmin",
                secret_key="minioadmin",
                bucket_name="iuris-docs",
                public_url=public_url,
            )
        return client

    def test_replaces_internal_hostname_when_public_url_set(self) -> None:
        client = self._make_client(public_url="http://localhost:9000")
        internal_url = (
            "http://minio:9000/iuris-docs/casos/1/doc.pdf"
            "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc"
        )
        client._client.generate_presigned_url = MagicMock(return_value=internal_url)

        result = client.generate_presigned_url("get_object", "casos/1/doc.pdf", expires_in=300)

        assert result.startswith("http://localhost:9000/")
        assert "minio:9000" not in result

    def test_does_not_replace_when_public_url_not_set(self) -> None:
        client = self._make_client(public_url=None)
        r2_url = (
            "https://account.r2.cloudflarestorage.com/iuris-docs/casos/1/doc.pdf"
            "?X-Amz-Signature=abc"
        )
        client._client.generate_presigned_url = MagicMock(return_value=r2_url)

        result = client.generate_presigned_url("get_object", "casos/1/doc.pdf")

        assert result == r2_url

    def test_put_object_operation_passed_correctly(self) -> None:
        client = self._make_client()
        client._client.generate_presigned_url = MagicMock(
            return_value="http://minio:9000/iuris-docs/key?sig=x"
        )

        client.generate_presigned_url("put_object", "casos/1/nuevo.pdf", expires_in=600)

        client._client.generate_presigned_url.assert_called_once_with(
            ClientMethod="put_object",
            Params={"Bucket": "iuris-docs", "Key": "casos/1/nuevo.pdf"},
            ExpiresIn=600,
        )


# ── get_storage_client ────────────────────────────────────────────────────────

class TestGetStorageClient:
    def test_returns_storage_client_with_env_vars(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("STORAGE_ENDPOINT_URL", "http://minio:9000")
        monkeypatch.setenv("STORAGE_ACCESS_KEY", "minioadmin")
        monkeypatch.setenv("STORAGE_SECRET_KEY", "minioadmin")
        monkeypatch.setenv("STORAGE_BUCKET_NAME", "iuris-docs")
        monkeypatch.setenv("STORAGE_PUBLIC_URL", "http://localhost:9000")

        with patch("app.core.storage.boto3.client"):
            client = get_storage_client()

        assert isinstance(client, StorageClient)
        assert client._bucket == "iuris-docs"
        assert client._public_url == "http://localhost:9000"

    def test_public_url_optional(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("STORAGE_ENDPOINT_URL", "https://account.r2.cloudflarestorage.com")
        monkeypatch.setenv("STORAGE_ACCESS_KEY", "key")
        monkeypatch.setenv("STORAGE_SECRET_KEY", "secret")
        monkeypatch.setenv("STORAGE_BUCKET_NAME", "iuris-docs")
        monkeypatch.delenv("STORAGE_PUBLIC_URL", raising=False)

        with patch("app.core.storage.boto3.client"):
            client = get_storage_client()

        assert client._public_url is None
