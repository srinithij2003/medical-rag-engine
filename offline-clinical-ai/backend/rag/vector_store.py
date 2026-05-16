from collections.abc import Sequence

import chromadb


class LocalVectorStore:
    def __init__(self, path: str = './data/chroma') -> None:
        self.client = chromadb.PersistentClient(path=path)
        self.collection = self.client.get_or_create_collection('clinical-notes')

    def upsert(self, ids: Sequence[str], documents: Sequence[str]) -> None:
        self.collection.upsert(ids=list(ids), documents=list(documents))

    def query(self, query_text: str, top_k: int = 3) -> list[str]:
        result = self.collection.query(query_texts=[query_text], n_results=top_k)
        return result.get('documents', [[]])[0]
