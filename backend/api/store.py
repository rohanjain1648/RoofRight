"""Case + file storage: LocalStack (DynamoDB + S3) when reachable, in-memory otherwise."""
from __future__ import annotations
import os, json, uuid, decimal
from typing import Any

ENDPOINT = os.environ.get("AWS_ENDPOINT_URL", "http://localhost:4566")
TABLE = os.environ.get("CASES_TABLE", "roofright-cases")
BUCKET = os.environ.get("FILES_BUCKET", "roofright-files")
_mem_cases: dict[str, dict] = {}
_mem_files: dict[str, bytes] = {}
_aws = None


def _kw() -> dict:
    return dict(endpoint_url=ENDPOINT, region_name="ap-south-1",
                aws_access_key_id="test", aws_secret_access_key="test")


def _client(kind: str):
    import boto3
    from botocore.config import Config
    return boto3.client(kind, config=Config(connect_timeout=1, read_timeout=3, retries={"max_attempts": 1}), **_kw())


def _table():
    import boto3
    return boto3.resource("dynamodb", **_kw()).Table(TABLE)


def aws_ready() -> bool:
    global _aws
    if _aws is not None:
        return _aws
    if os.environ.get("ROOFRIGHT_STORE") == "memory":
        _aws = False
        return _aws
    try:
        ddb, s3 = _client("dynamodb"), _client("s3")
        try:
            ddb.describe_table(TableName=TABLE)
        except ddb.exceptions.ResourceNotFoundException:
            ddb.create_table(TableName=TABLE, KeySchema=[{"AttributeName": "id", "KeyType": "HASH"}],
                             AttributeDefinitions=[{"AttributeName": "id", "AttributeType": "S"}],
                             BillingMode="PAY_PER_REQUEST")
        try:
            s3.head_bucket(Bucket=BUCKET)
        except Exception:
            s3.create_bucket(Bucket=BUCKET, CreateBucketConfiguration={"LocationConstraint": "ap-south-1"})
        _aws = True
    except Exception:
        _aws = False
    return _aws


def backend_name() -> str:
    return "localstack" if aws_ready() else "memory"


def _dec(o: Any):
    if isinstance(o, decimal.Decimal):
        return int(o) if o == o.to_integral_value() else float(o)
    raise TypeError


def save_case(case: dict) -> dict:
    case.setdefault("id", uuid.uuid4().hex[:10])
    if aws_ready():
        _table().put_item(Item=json.loads(json.dumps(case), parse_float=decimal.Decimal))
    else:
        _mem_cases[case["id"]] = case
    return case


def get_case(case_id: str) -> dict | None:
    if aws_ready():
        item = _table().get_item(Key={"id": case_id}).get("Item")
        return json.loads(json.dumps(item, default=_dec)) if item else None
    return _mem_cases.get(case_id)


def put_file(key: str, data: bytes, content_type: str = "application/pdf") -> None:
    if aws_ready():
        _client("s3").put_object(Bucket=BUCKET, Key=key, Body=data, ContentType=content_type)
    else:
        _mem_files[key] = data


def get_file(key: str) -> bytes | None:
    if aws_ready():
        try:
            return _client("s3").get_object(Bucket=BUCKET, Key=key)["Body"].read()
        except Exception:
            return None
    return _mem_files.get(key)
