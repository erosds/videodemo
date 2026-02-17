from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class DatasetInfo(BaseModel):
    filename: str
    rows: int
    columns: int
    features: List[str]
    non_numeric_features: List[str] = []
    target: str
    task_type: str = "classification"
    n_classes: Optional[int] = None
    class_type: Optional[str] = None
    classes_dtype: Optional[str] = None
    class_distribution: Dict[str, int]
    rows_with_nan: int = 0
    preview: List[Dict[str, Any]] = []

class TrainingRequest(BaseModel):
    dataset: str
    models: List[str]
    test_size: float = 0.2
    random_state: int = 42

class PredictionRequest(BaseModel):
    dataset: str
    model_name: str

class TrainingProgress(BaseModel):
    model: str
    status: str
    progress: float
    metrics: Optional[Dict[str, Any]] = None
    
class PredictionResult(BaseModel):
    predictions: List[Dict[str, Any]]
    metrics: Dict[str, float]

class FeatureImportanceRequest(BaseModel):
    dataset: str
    model_name: str