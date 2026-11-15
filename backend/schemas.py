from datetime import datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, ConfigDict

# ----------------- Auth & Users -----------------
class UserBase(BaseModel):
    email: str = Field(max_length=255)
    full_name: str = Field(max_length=255)
    role: str = Field(default="company", max_length=50)
    city: Optional[str] = Field(default=None, max_length=50)
    company_id: Optional[str] = Field(default=None, max_length=50)
    is_senior: bool = False
    qualifications: List[str] = Field(default_factory=list)
    avatar_url: Optional[str] = None

class UserCreate(BaseModel):
    email: str = Field(max_length=255)
    full_name: str = Field(max_length=255)
    password: str = Field(min_length=6, max_length=100)
    city: Optional[str] = Field(default=None, max_length=50)
    code: Optional[str] = Field(default=None, max_length=20)
    role: Optional[str] = None  # Ignored in registration per K4
    is_senior: Optional[bool] = None  # Ignored in registration per K4
    qualifications: Optional[List[str]] = None  # Ignored in registration per K4
    avatar_url: Optional[str] = None

    model_config = ConfigDict(extra="forbid")

class StaffCreate(BaseModel):
    email: str = Field(max_length=255)
    full_name: str = Field(max_length=255)
    role: Literal["dispatcher", "engineer"]
    city: Optional[Literal["Москва", "Тула"]] = "Москва"
    is_senior: bool = False
    qualifications: List[str] = Field(default_factory=list)
    password: str = Field(min_length=6, max_length=100)

    model_config = ConfigDict(extra="forbid")

class SendCodeRequest(BaseModel):
    email: str = Field(max_length=255)

    model_config = ConfigDict(extra="forbid")

class SendCodeResponse(BaseModel):
    status: str
    message: str

class ConfirmCodeRequest(BaseModel):
    code: str = Field(min_length=1, max_length=20)

    model_config = ConfigDict(extra="forbid")

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=255)
    email: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, max_length=50)
    is_senior: Optional[bool] = None
    qualifications: Optional[List[str]] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = Field(default=None, max_length=100)
    code: Optional[str] = Field(default=None, max_length=20)  # Needed if email is changed

    model_config = ConfigDict(extra="forbid")

class UserResponse(UserBase):
    id: int
    is_demo: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class LoginRequest(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(max_length=100)

    model_config = ConfigDict(extra="forbid")

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# ----------------- Equipment -----------------
class EquipmentCreate(BaseModel):
    code: Optional[str] = Field(default=None, max_length=50)
    client_name: Optional[str] = Field(default=None, max_length=255)
    company_id: Optional[str] = Field(default=None, max_length=50)
    address: str = Field(max_length=255)
    city: Optional[str] = Field(default="Москва", max_length=50)
    model: str = Field(max_length=50)
    serial_number: str = Field(max_length=50)
    installation_date: Optional[datetime] = None

    model_config = ConfigDict(extra="forbid")

class EquipmentResponse(BaseModel):
    id: int
    code: str
    client_name: str
    company_id: Optional[str] = None
    address: str
    city: str
    model: str
    serial_number: str
    installation_date: datetime
    last_visit_date: Optional[datetime] = None
    last_visit_result: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# ----------------- Spare Parts -----------------
class SparePartResponse(BaseModel):
    id: int
    code: str
    name: str
    compatible_models: List[str]
    moscow_stock: int
    moscow_reserved: int
    moscow_free: int
    tula_stock: int
    tula_reserved: int
    tula_free: int

    model_config = ConfigDict(from_attributes=True)

class ReservedPartItem(BaseModel):
    code: str = Field(max_length=50)
    name: Optional[str] = Field(default=None, max_length=255)
    quantity: int = Field(default=1, ge=1, le=10)
    source_city: Literal["Москва", "Тула"]
    transfer_required: bool = False

    model_config = ConfigDict(extra="forbid")

# ----------------- Messages -----------------
class MessageCreate(BaseModel):
    content: str = Field(max_length=4000)
    channel: Optional[str] = Field(default="Мессенджер", max_length=50)
    chat_type: Optional[str] = Field(default="client_dispatcher", max_length=50)
    sender_type: Optional[str] = Field(default=None, max_length=50)
    sender_name: Optional[str] = Field(default=None, max_length=255)

    model_config = ConfigDict(extra="forbid")

class MessageResponse(BaseModel):
    id: int
    thread_id: int
    request_code: Optional[str] = None
    channel: str
    chat_type: Optional[str] = "client_dispatcher"
    sender_type: str
    sender_name: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# ----------------- Client Threads -----------------
class ClientThreadResponse(BaseModel):
    id: int
    thread_number: int
    client_name: str
    company_id: Optional[str] = None
    owner_user_id: Optional[int] = None
    equipment_id: Optional[int] = None
    equipment_code: Optional[str] = None
    status: str
    channel: str
    is_warranty: bool
    warranty_reason: Optional[str] = None
    is_unregistered: bool
    last_activity: datetime
    created_at: datetime
    messages: List[MessageResponse] = Field(default_factory=list)
    equipment: Optional[EquipmentResponse] = None
    linked_order_number: Optional[str] = None
    assigned_engineer_name: Optional[str] = None
    assigned_engineer_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class CreateThreadRequest(BaseModel):
    client_name: Optional[str] = Field(default=None, max_length=255)
    equipment_code: Optional[str] = Field(default=None, max_length=50)
    channel: str = Field(default="Мессенджер", max_length=50)
    content: str = Field(max_length=4000)

    model_config = ConfigDict(extra="forbid")

class SimulateCustomerMessageRequest(BaseModel):
    client_name: str = Field(max_length=255)
    channel: str = Field(default="Мессенджер", max_length=50)
    content: str = Field(max_length=4000)
    request_code: Optional[str] = Field(default=None, max_length=50)

    model_config = ConfigDict(extra="forbid")

# ----------------- AI Analysis -----------------
class RecommendedPartCandidate(BaseModel):
    code: str
    name: str
    is_compatible: bool
    local_stock: int
    local_reserved: int
    local_free: int
    other_city_free: int
    transfer_required: bool
    status_note: str
    diagnostic_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AIAnalysisResult(BaseModel):
    detected_equipment_code: Optional[str] = None
    detected_model: Optional[str] = None
    detected_serial: Optional[str] = None
    equipment_reasoning: Optional[str] = None
    is_unregistered_machine: bool = False
    is_ambiguous_machine: bool = False
    ambiguity_explanation: Optional[str] = None
    is_warranty: bool = False
    warranty_reason: Optional[str] = None
    error_code: Optional[str] = None
    error_explanation: Optional[str] = None
    draft_symptom: str
    client_assumption: Optional[str] = None
    reply_to_client: str
    missing_questions: List[str] = Field(default_factory=list)
    recommended_parts: List[RecommendedPartCandidate] = Field(default_factory=list)
    rules_applied: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

class AIReplyGenerateRequest(BaseModel):
    thread_id: int
    custom_instruction: Optional[str] = Field(default=None, max_length=1000)

    model_config = ConfigDict(extra="forbid")

class AITextAnalysisRequest(BaseModel):
    text: str = Field(max_length=4000)
    client_name: Optional[str] = Field(default=None, max_length=255)

    model_config = ConfigDict(extra="forbid")

# ----------------- Orders -----------------
class ServiceOrderCreate(BaseModel):
    thread_id: Optional[int] = None
    client_name: str = Field(max_length=255)
    equipment_code: Optional[str] = Field(default=None, max_length=50)
    address: str = Field(max_length=255)
    model: str = Field(max_length=50)
    serial_number: str = Field(max_length=50)
    symptom: str = Field(max_length=2000)
    client_assumption: Optional[str] = Field(default=None, max_length=1000)
    is_warranty: bool = False
    warranty_reason: Optional[str] = Field(default=None, max_length=1000)
    is_sales_transfer: bool = False
    engineer_id: Optional[int] = None
    reserved_parts: List[ReservedPartItem] = Field(default_factory=list)
    created_at: Optional[datetime] = None

    model_config = ConfigDict(extra="forbid")

class ServiceOrderStatusUpdate(BaseModel):
    status: Literal["Новая", "Назначен", "В пути", "На месте", "Выполнен", "Отменен"]

    model_config = ConfigDict(extra="forbid")

class ServiceOrderUpdate(BaseModel):
    client_name: Optional[str] = Field(default=None, max_length=255)
    address: Optional[str] = Field(default=None, max_length=255)
    model: Optional[str] = Field(default=None, max_length=50)
    serial_number: Optional[str] = Field(default=None, max_length=50)
    symptom: Optional[str] = Field(default=None, max_length=2000)
    client_assumption: Optional[str] = Field(default=None, max_length=1000)
    is_warranty: Optional[bool] = None
    warranty_reason: Optional[str] = Field(default=None, max_length=1000)
    status: Optional[str] = Field(default=None, max_length=50)
    engineer_id: Optional[int] = None
    reserved_parts: Optional[List[ReservedPartItem]] = None
    inspection_report: Optional[str] = Field(default=None, max_length=4000)

    model_config = ConfigDict(extra="forbid")

class ServiceOrderReportUpdate(BaseModel):
    inspection_report: str = Field(max_length=4000)
    status: Optional[str] = Field(default="Выполнен", max_length=50)

    model_config = ConfigDict(extra="forbid")

class ServiceOrderResponse(BaseModel):
    id: int
    order_number: str
    thread_id: Optional[int] = None
    client_name: str
    company_id: Optional[str] = None
    equipment_id: Optional[int] = None
    equipment_code: Optional[str] = None
    address: str
    model: str
    serial_number: str
    symptom: str
    client_assumption: Optional[str] = None
    is_warranty: bool
    warranty_reason: Optional[str] = None
    is_sales_transfer: bool
    status: str
    engineer_id: Optional[int] = None
    engineer: Optional[UserResponse] = None
    reserved_parts: List[Dict[str, Any]] = Field(default_factory=list)
    inspection_report: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
