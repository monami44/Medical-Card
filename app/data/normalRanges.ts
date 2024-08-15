export const normalRanges = {
    WBC: { 
      Adults: { min: 4000, max: 11000 },
      Children: { min: 5000, max: 10000 },
      Newborns: { min: 9000, max: 30000 },
      unit: "cells/µL"
    },
    RBC: { 
      Men: { min: 4.7, max: 6.1 },
      Women: { min: 4.2, max: 5.4 },
      Children: { min: 4.1, max: 5.5 },
      Newborns: { min: 4.8, max: 7.2 },
      unit: "M cells/µL"
    },
    HGB: { 
      Men: { min: 13.8, max: 17.2 },
      Women: { min: 12.1, max: 15.1 },
      Children: { min: 11, max: 16 },
      Newborns: { min: 14, max: 24 },
      unit: "g/dL"
    },
    HCT: { 
      Men: { min: 41, max: 50 },
      Women: { min: 36, max: 48 },
      Children: { min: 35, max: 45 },
      Newborns: { min: 44, max: 64 },
      unit: "%"
    },
    MCV: { 
      Adults: { min: 80, max: 100 },
      Children: { min: 70, max: 86 },
      Newborns: { min: 95, max: 120 },
      unit: "fL"
    },
    MCH: { 
      Adults: { min: 27, max: 33 },
      Children: { min: 24, max: 30 },
      Newborns: { min: 30, max: 37 },
      unit: "pg/cell"
    },
    // ... add other parameters as needed
  };
  
  export type NormalRangeKey = keyof typeof normalRanges;