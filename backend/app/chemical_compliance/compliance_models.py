from enum import Enum
from pydantic import BaseModel
from typing import Literal, List, Dict, Any, Optional


class IngestRequest(BaseModel):
    name: str
    content: str  # base64 PDF/DOCX or plain text
    document_type: Literal["SOP", "SDS", "REGULATION", "METHOD", "COA"]
    matrix_type: Literal["cosmetic", "food", "solvent", "polymer", "pharma", "general"]
    revision: str = "1.0"


class IngestResponse(BaseModel):
    doc_id: str
    chunks_created: int
    status: str


class DocumentInfo(BaseModel):
    doc_id: str
    name: str
    document_type: str
    matrix_type: str
    revision: str
    upload_date: str
    chunks: int


class SourceRef(BaseModel):
    source_file: str
    section_title: str
    score: float
    text_snippet: str


class ConversationMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class QueryRequest(BaseModel):
    query: str
    mode: Literal["general", "regulatory", "sds_extract"] = "general"
    document_types: List[str] = []
    top_k: int = 5
    messages: List["ConversationMessage"] = []  # conversation history


class QueryResponse(BaseModel):
    answer: str
    sources: List[SourceRef]
    extracted_entities: Dict[str, Any]
    confidence_score: float


class FilePayload(BaseModel):
    name: str
    content: str  # plain text content


class BatchCompareRequest(BaseModel):
    file1: FilePayload
    file2: FilePayload
    threshold: float = 5.0


class ParameterDiff(BaseModel):
    name: str
    val1: Optional[float]
    val2: Optional[float]
    deviation: Optional[float]
    flagged: bool


class BatchCompareResponse(BaseModel):
    parameters: List[ParameterDiff]
    summary: str


class SdsExtractRequest(BaseModel):
    content: str


class SdsExtractResponse(BaseModel):
    cas: Optional[str]
    substance_name: Optional[str]
    hazard_statements: List[str]
    precautionary_statements: List[str]
    clp_classification: List[str]
    signal_word: Optional[str]
    exposure_limits: List[str]


class ProductType(str, Enum):
    rinse_off = "rinse_off"
    leave_on = "leave_on"
    oral = "oral"
    eye = "eye"
    spray = "spray"
    sunscreen = "sunscreen"


class IngredientCheckRequest(BaseModel):
    inci_name: str
    concentration_pct: float
    product_type: ProductType = ProductType.leave_on


class IngredientCheckResponse(BaseModel):
    inci_name: str
    cas: Optional[str]
    status: str           # compliant | restricted | prohibited | unknown
    max_allowed_pct: Optional[float]
    conditions: Optional[str]
    annex_ref: Optional[str]
    plain_explanation: str
    warnings: List[str]


class FormulaIngredient(BaseModel):
    inci_name: str
    concentration_pct: float


class FormulaScreenRequest(BaseModel):
    ingredients: List[FormulaIngredient]
    product_type: ProductType = ProductType.leave_on


class FormulaScreenResponse(BaseModel):
    overall_status: str     # compliant | warnings | non_compliant
    per_ingredient: List[IngredientCheckResponse]
    allergen_warnings: List[Dict[str, Any]]
    label_requirements: List[str]
    summary: str


class AuditEvent(BaseModel):
    timestamp: str
    action: str
    details: Dict[str, Any]


class HealthResponse(BaseModel):
    qdrant: str
    ollama: str
