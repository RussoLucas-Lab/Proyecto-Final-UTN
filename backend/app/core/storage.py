import os
from typing import Literal

import boto3
from botocore.config import Config


class StorageClient:
    def __init__(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        bucket_name: str,
        public_url: str | None = None,
    ) -> None:
        self._bucket = bucket_name

        # Client for internal operations (health checks, bucket admin, etc.)
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )

        # Presigned URL generation uses the PUBLIC endpoint so the signature
        # covers the hostname the browser will actually hit. Rewriting the host
        # after signing breaks the HMAC — the host must match at sign time.
        presign_endpoint = public_url.rstrip("/") if public_url else endpoint_url
        self._presign_client = (
            boto3.client(
                "s3",
                endpoint_url=presign_endpoint,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name="auto",
                config=Config(signature_version="s3v4"),
            )
            if presign_endpoint != endpoint_url
            else self._client
        )

    def generate_presigned_url(
        self,
        operation: Literal["put_object", "get_object"],
        key: str,
        expires_in: int = 3600,
        internal: bool = False,
    ) -> str:
        # Browser-facing URLs sign against the PUBLIC endpoint (the host the
        # browser reaches). Server-to-server consumers inside the Docker network
        # (e.g. n8n WF-02 uploading a backup) must sign against the INTERNAL
        # endpoint — from a container, the public host (localhost) is unreachable.
        client = self._client if internal else self._presign_client
        url: str = client.generate_presigned_url(
            ClientMethod=operation,
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )
        return url


def get_storage_client() -> StorageClient:
    return StorageClient(
        endpoint_url=os.environ["STORAGE_ENDPOINT_URL"],
        access_key=os.environ["STORAGE_ACCESS_KEY"],
        secret_key=os.environ["STORAGE_SECRET_KEY"],
        bucket_name=os.environ["STORAGE_BUCKET_NAME"],
        public_url=os.environ.get("STORAGE_PUBLIC_URL"),
    )
