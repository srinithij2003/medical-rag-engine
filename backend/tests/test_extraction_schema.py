from backend.models.schemas import ExtractionSchema


def test_extraction_schema_defaults():
    data = ExtractionSchema()
    assert data.symptoms == []
    assert data.medications == []
    assert data.duration is None
