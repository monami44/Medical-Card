from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BloodTestResults(BaseModel):
    report_date: Optional[datetime] = None
    WBC: Optional[float]  # White Blood Cell count
    RBC: Optional[float]  # Red Blood Cell count
    HGB: Optional[float]  # Hemoglobin
    HCT: Optional[float]  # Hematocrit
    MCV: Optional[float]  # Mean Corpuscular Volume
    MCH: Optional[float]  # Mean Corpuscular Hemoglobin
    MCHC: Optional[float]  # Mean Corpuscular Hemoglobin Concentration
    PLT: Optional[float]  # Platelet count
    LYM_percent: Optional[float]  # Lymphocyte percentage
    MXD_percent: Optional[float]  # Mixed cell percentage
    NEUT_percent: Optional[float]  # Neutrophil percentage
    LYM_count: Optional[float]  # Lymphocyte count
    MXD_count: Optional[float]  # Mixed cell count
    NEUT_count: Optional[float]  # Neutrophil count
    RDW_SD: Optional[float]  # Red cell Distribution Width - Standard Deviation
    RDW_CV: Optional[float]  # Red cell Distribution Width - Coefficient of Variation
    PDW: Optional[float]  # Platelet Distribution Width
    MPV: Optional[float]  # Mean Platelet Volume
    P_LCR: Optional[float]  # Platelet Large Cell Ratio
    PCT: Optional[float]  # Plateletcrit