from backend.services.extraction_service import chunk_text


def test_chunk_text_single_chunk_for_short_input():
    chunks = chunk_text('short text', max_chars=100)
    assert len(chunks) == 1


def test_chunk_text_multiple_for_long_input():
    text = 'a' * 1000
    chunks = chunk_text(text, max_chars=300, overlap=20)
    assert len(chunks) > 1
