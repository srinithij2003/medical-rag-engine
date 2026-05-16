from backend.utils.config import settings


class ModelRegistry:
    def __init__(self) -> None:
        self.current_model = settings.ollama_model

    def get_selected_model(self) -> str:
        return self.current_model

    def set_selected_model(self, model_name: str) -> None:
        self.current_model = model_name


model_registry = ModelRegistry()
