export const VERSION    = "v0.3.2";
export const BUILD_DATE = "2026-03-18";
export const SR_GATE_URL   = "https://sr-gate.vercel.app";
export const MANUAL_URL_EN = "https://seoulrobotics.atlassian.net/wiki/spaces/~7120204b7d273e948148e7a6e61c8a943425b1/pages/3879501832";
export const MANUAL_URL_KO = "https://seoulrobotics.atlassian.net/wiki/spaces/~7120204b7d273e948148e7a6e61c8a943425b1/pages/3879501832";

export const REQ_CATEGORIES = {
  general:   { label:"General Request",  icon:"📋", types:["business_card","onboarding_item","onboarding_account","offboarding_item","offboarding_account","corporate_card"] },
  travel:    { label:"Business Travel",  icon:"✈️", types:["domestic_trip","overseas_trip"] },
  breakdown: { label:"Breakdown Report", icon:"🔧", types:["asset_breakdown","facility_breakdown","it_breakdown","item_breakdown"] },
  rental:    { label:"Rental Request",   icon:"📦", types:["car_rental","rnd_item","equipment_rental"] },
};

export const REQ_TYPES = {
  business_card:       { label:"Business Card",           cat:"general",   icon:"🪪" },
  onboarding_item:     { label:"Onboarding Items",        cat:"general",   icon:"🎁" },
  onboarding_account:  { label:"Onboarding Account",      cat:"general",   icon:"🔑" },
  offboarding_item:    { label:"Offboarding Item Return", cat:"general",   icon:"↩️" },
  offboarding_account: { label:"Offboarding Account",     cat:"general",   icon:"🔐" },
  corporate_card:      { label:"Corporate Card",          cat:"general",   icon:"💳" },
  domestic_trip:       { label:"Domestic Trip",           cat:"travel",    icon:"🚆" },
  overseas_trip:       { label:"Overseas Trip",           cat:"travel",    icon:"✈️" },
  asset_breakdown:     { label:"Asset Breakdown",         cat:"breakdown", icon:"💻" },
  facility_breakdown:  { label:"Facility Breakdown",      cat:"breakdown", icon:"🏢" },
  it_breakdown:        { label:"IT Breakdown",            cat:"breakdown", icon:"🖥️" },
  item_breakdown:      { label:"Item Breakdown",          cat:"breakdown", icon:"📦" },
  car_rental:          { label:"Company Car Rental",      cat:"rental",    icon:"🚗" },
  rnd_item:            { label:"R&D Item Request",        cat:"rental",    icon:"🔬" },
  equipment_rental:    { label:"Equipment Rental",        cat:"rental",    icon:"🪑" },
};

export const DEFAULT_CHAINS = {
  business_card:["assignee"],       onboarding_item:["assignee"],
  onboarding_account:["assignee"],  offboarding_item:["assignee"],
  offboarding_account:["assignee"], corporate_card:["manager","ceo","assignee"],
  domestic_trip:["manager","assignee"], overseas_trip:["manager","ceo","assignee"],
  asset_breakdown:["assignee"],     facility_breakdown:["assignee"],
  it_breakdown:["assignee"],        item_breakdown:["assignee"],
  car_rental:["assignee"],          rnd_item:["assignee"], equipment_rental:["assignee"],
};

export const ONBOARDING_ITEMS        = ["PC / Laptop","Monitor","Uniform","Sticker","Crocs","Desk Chair","Access Card","Other"];
export const TRAVEL_SUBS_DOMESTIC    = ["Airfare","Hotel","Transportation","Other","Expense Claim"];
export const TRAVEL_SUBS_OVERSEAS    = ["Airfare","Hotel","Transportation","Other","Expense Claim"];

export const C = {
  primary:"#1d4ed8", primaryLight:"#dbeafe",
  danger:"#dc2626",  dangerLight:"#fee2e2",
  success:"#16a34a", successLight:"#dcfce7",
  warning:"#d97706", warningLight:"#fef3c7",
  purple:"#7c3aed",  purpleLight:"#ede9fe",
  gray:"#6b7280",    grayLight:"#f3f4f6",
  border:"#e5e7eb",  text:"#111827", muted:"#6b7280",
  bg:"#f9fafb",      white:"#ffffff",
};

export const STATUS = {
  pending:     { bg:"#fef9c3", color:"#854d0e", label:"Pending"     },
  in_progress: { bg:"#dbeafe", color:"#1e40af", label:"In Progress" },
  approved:    { bg:"#dcfce7", color:"#15803d", label:"Approved"    },
  rejected:    { bg:"#fee2e2", color:"#b91c1c", label:"Rejected"    },
  completed:   { bg:"#f0fdf4", color:"#166534", label:"Completed"   },
  cancelled:   { bg:"#f3f4f6", color:"#6b7280", label:"Cancelled"   },
};

export const ALLOWED_MIME = [
  "image/jpeg","image/png","image/gif","image/webp","application/pdf",
  "application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/plain",
];
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
