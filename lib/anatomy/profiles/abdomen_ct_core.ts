type Side = "L" | "R" | "M"
type Category = "organ" | "artery" | "vein"

type AbdomenStructure = {
  id: string
  labelEs: string
  side: Side
  category: Category
}

const ABDOMEN_STRUCTURES: AbdomenStructure[] = [
  // =====================================================
  // SOLID ORGANS
  // =====================================================

  { id: "liver", labelEs: "Hígado", side: "R", category: "organ" },

  { id: "spleen", labelEs: "Bazo", side: "L", category: "organ" },

  { id: "stomach", labelEs: "Estómago", side: "L", category: "organ" },

  { id: "pancreas", labelEs: "Páncreas", side: "M", category: "organ" },

  { id: "gallbladder", labelEs: "Vesícula biliar", side: "R", category: "organ" },

  { id: "kidney_r", labelEs: "Riñón derecho", side: "R", category: "organ" },

  { id: "kidney_l", labelEs: "Riñón izquierdo", side: "L", category: "organ" },

  // =====================================================
  // VASCULAR
  // =====================================================

  { id: "aorta", labelEs: "Aorta abdominal", side: "M", category: "artery" },

  { id: "ivc", labelEs: "Vena Cava Inferior", side: "M", category: "vein" },

  { id: "portal_vein", labelEs: "Vena porta", side: "M", category: "vein" },

  { id: "smv", labelEs: "Vena mesentérica superior", side: "M", category: "vein" },

  { id: "common_iliac_r", labelEs: "Ilíaca común derecha", side: "R", category: "artery" },

  { id: "common_iliac_l", labelEs: "Ilíaca común izquierda", side: "L", category: "artery" },

  { id: "external_iliac_r", labelEs: "Ilíaca externa derecha", side: "R", category: "artery" },

  { id: "external_iliac_l", labelEs: "Ilíaca externa izquierda", side: "L", category: "artery" },

  // =====================================================
  // MUSCULOSKELETAL
  // =====================================================

  { id: "psoas_r", labelEs: "Psoas derecho", side: "R", category: "organ" },

  { id: "psoas_l", labelEs: "Psoas izquierdo", side: "L", category: "organ" },

  { id: "vertebral_body", labelEs: "Cuerpo vertebral", side: "M", category: "organ" },

  // =====================================================
  // DIGESTIVE
  // =====================================================

  { id: "ascending_colon", labelEs: "Colon ascendente", side: "R", category: "organ" },

  { id: "transverse_colon", labelEs: "Colon transverso", side: "M", category: "organ" },

  { id: "descending_colon", labelEs: "Colon descendente", side: "L", category: "organ" },

  { id: "sigmoid_colon", labelEs: "Colon sigmoides", side: "L", category: "organ" },

  { id: "rectum", labelEs: "Recto", side: "M", category: "organ" },

  // =====================================================
  // PELVIS
  // =====================================================

  { id: "bladder", labelEs: "Vejiga", side: "M", category: "organ" },

  { id: "prostate", labelEs: "Próstata", side: "M", category: "organ" },

  { id: "seminal_vesicle_r", labelEs: "Vesícula seminal derecha", side: "R", category: "organ" },

  { id: "seminal_vesicle_l", labelEs: "Vesícula seminal izquierda", side: "L", category: "organ" },

  // =====================================================
// VASCULAR - ADDITIONS
// =====================================================

{ id: "celiac_trunk", labelEs: "Tronco celíaco", side: "M", category: "artery" },

{ id: "sma", labelEs: "Arteria mesentérica superior", side: "M", category: "artery" },

{ id: "renal_artery_r", labelEs: "Arteria renal derecha", side: "R", category: "artery" },

{ id: "renal_artery_l", labelEs: "Arteria renal izquierda", side: "L", category: "artery" },

{ id: "renal_vein_r", labelEs: "Vena renal derecha", side: "R", category: "vein" },

{ id: "renal_vein_l", labelEs: "Vena renal izquierda", side: "L", category: "vein" },

{ id: "splenic_vein", labelEs: "Vena esplénica", side: "L", category: "vein" },
// =====================================================
// ORGANS - ADDITIONS
// =====================================================

{ id: "adrenal_r", labelEs: "Glándula suprarrenal derecha", side: "R", category: "organ" },

{ id: "adrenal_l", labelEs: "Glándula suprarrenal izquierda", side: "L", category: "organ" },

{ id: "duodenum", labelEs: "Duodeno", side: "M", category: "organ" },
]

export const ABDOMEN_CT_CORE_PROFILE = {
  id: "abdomen_ct_core",
  label: "TC abdomen y pelvis - anatomía básica",
  structures: ABDOMEN_STRUCTURES,
} as const