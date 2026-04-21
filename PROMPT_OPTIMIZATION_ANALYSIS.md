# Prompt Optimization Analysis: Conventional Deadlift (Frontal)

## User's Original Prompt (Truncated at User's Message)

### Prompt Gen Imagen 1 (IMAGE)
```
High quality commercial fitness photography, vertical 9:16 aspect ratio. 
ABSOLUTELY PERFECT DIRECT FRONT-FACING SHOT. 0 degree deviation. Perfect bilateral symmetry. 
Camera placed at subject eye-level, dead centre, no tilt, no rotation. 

STRICT ANGLE ENFORCEMENT: A shot that deviates from the specified camera angle is ABSOLUTELY FORBIDDEN and voids the entire prompt. 
If the angle is lateral/side profile, the camera must be at exactly 90° from the frontal plane — the viewer sees the pure side silhouette, NOT the chest, NOT the face. 
If the angle is posterior/rear, the camera is directly behind. The specified angle is non-negotiable and must be maintained for every single frame.

A fit, athletic 30-year-old man with a lean, naturally toned physique — visible muscle definition, flat stomach, broad shoulders, but NOT a bodybuilder. 
He looks like a dedicated gym-goer or personal trainer: healthy, functional fitness level, moderate muscle size. 
Think men's fitness magazine cover, NOT a mass-gaining bodybuilder competition. 
He is shirtless to clearly display muscle activation and wearing solid black athletic shorts.

The athlete is positioned in the LOCKOUT position of a conventional deadlift: 
standing fully erect, hips locked out at 0° extension, knees locked out at 0° extension, shoulders positioned directly over the barbell, 
spine in perfect neutral alignment from cervical through lumbar segments. 
Arms are fully extended at 0° elbow flexion, hanging vertically downward. 
The barbell is held at mid-thigh height, gripped firmly in both hands.

Erector spinae muscles are visibly engaged maintaining spinal neutrality, gluteus maximus contracted at full hip extension, 
hamstrings taut from full knee lockout. 
Scapulae are retracted, lats engaged, chest lifted, head in neutral position aligned with spine.

Feet are positioned hip-width apart, weight distributed evenly through mid-foot, knees tracking in line with toes.

The athlete displays perfect bilateral symmetry from this frontal view: 
both shoulders level, both arms equally extended, both legs bearing equal load.

The barbell is clearly visible, gripped in both hands with full hand and finger definition — 
realistic five fingers securely wrapped around the bar on each hand, thumbs visibly locked around the bar in a pronated grip. 
The metal barbell does NOT blend or fuse with the skin. No extra fingers, no fused fingers, no floating hands, no missing thumbs. 
Natural knuckle definition and realistic skin compression against the knurled bar surface. 

The barbell rests against the front of both thighs at mid-thigh level, under complete control.

The steel bar has visible mass and weight — it appears heavy and substantial, 
a solid straight horizontal implement extending symmetrically to both sides. 
From this frontal camera angle, the barbell is centered in the athlete's lower body, 
a horizontal line crossing the thighs with loaded plates visible on both ends.

The bar[CUTS HERE]
```

---

## TIER CATEGORIZATION

### **TIER 1: NON-NEGOTIABLE (NEVER TRUNCATE)**
These elements are essential for the generation to be valid. If any of these are missing/truncated, the entire output is unusable.

#### Format & Angle
- `High quality commercial fitness photography, vertical 9:16 aspect ratio.`
- `ABSOLUTELY PERFECT DIRECT FRONT-FACING SHOT. 0 degree deviation.`
- `STRICT ANGLE ENFORCEMENT: A shot that deviates from the specified camera angle is ABSOLUTELY FORBIDDEN and voids the entire prompt.`

#### Subject Identity
- `30-year-old man with a lean, naturally toned physique — visible muscle definition, flat stomach, broad shoulders, but NOT a bodybuilder.`
- `Shirtless to clearly display muscle activation and wearing solid black athletic shorts.`

#### Exercise Specificity (Deadlift Lockout Position)
- `LOCKOUT position of a conventional deadlift`
- `standing fully erect, hips locked out at 0° extension, knees locked out at 0° extension`
- `shoulders positioned directly over the barbell`
- `spine in perfect neutral alignment`
- `Arms are fully extended at 0° elbow flexion`
- `The barbell is held at mid-thigh height`

#### Implement Visibility & Grip (CRITICAL FOR BARBELL)
- `The barbell is clearly visible, gripped in both hands`
- `realistic five fingers securely wrapped around the bar on each hand`
- `thumbs visibly locked around the bar in a pronated grip`
- `The metal barbell does NOT blend or fuse with the skin`
- `The barbell rests against the front of both thighs at mid-thigh level`
- `barbell is centered in the athlete's lower body, a horizontal line crossing the thighs`
- `barbell is the focal point of the image`

#### Background (White Studio - TIER 1 because it's a hard constraint)
- `Premium rented fitness studio. The space is entirely white: bright white walls, smooth polished white concrete floor.`
- `Large industrial-style pendant lights hang from a white ceiling, casting soft, even, professional illumination.`
- `The ONLY objects visible in the frame are the athlete and the barbell. No other gym machines, no extra equipment, no other people.`
- `No gym equipment in background, no coloured walls, no mirrors, no other people visible.`

#### Shorts Logo (TIER 1 - User stated "no hay logo, no hay instrucciones del fondo" as a problem)
- `On the outer left thigh of the black shorts, there is [LOGO_DESCRIPTION]`
- `clearly visible, precisely placed, not on the right leg, not on both legs, only on the left thigh outer face`

#### Full Body Framing
- `FULL BODY SHOT: The subject's entire body must be visible from head to feet with generous margin`
- `The subject occupies approximately 40-50% of the frame height, centred in frame`
- `Wide shot equivalent to a 24mm wide-angle lens at 10-12 metres distance`
- `ABSOLUTE PROHIBITION: no cropping of feet, knees, hands, arms or head under any circumstance`

---

### **TIER 2: HIGH PRIORITY (CAN REDUCE IF NEEDED)**
These enhance biomechanical accuracy and visual quality but are not strictly necessary for validity.

#### Muscle Activation & Posture
- `Erector spinae muscles are visibly engaged maintaining spinal neutrality`
- `gluteus maximus contracted at full hip extension`
- `hamstrings taut from full knee lockout`
- `Scapulae are retracted, lats engaged, chest lifted`
- `Feet are positioned hip-width apart, weight distributed evenly through mid-foot, knees tracking in line with toes`

#### Bilateral Symmetry Details
- `The athlete displays perfect bilateral symmetry from this frontal view`
- `both shoulders level, both arms equally extended, both legs bearing equal load`
- `The steel bar has visible mass and weight — it appears heavy and substantial`
- `a solid straight horizontal implement extending symmetrically to both sides`

#### Lighting & Aesthetic
- `Soft professional studio key light, subtle rim light highlighting muscle contours, shadowless fill`
- `ideal for instructional biomechanics photography`
- `Hyper-realistic instructional fitness photograph, 8K resolution, sharp focus on full body, no artistic filters, no motion blur`
- `The athlete casts a soft natural shadow on the floor beneath them — realistic and grounded`

---

### **TIER 3: OPTIONAL (FIRST TO CUT)**
These are nice-to-have flourishes that don't affect the core generation.

#### Excessive Flourish Language
- `Think men's fitness magazine cover, NOT a mass-gaining bodybuilder competition.`
- `He looks like a dedicated gym-goer or personal trainer: healthy, functional fitness level, moderate muscle size.`
- `Perfect bilateral symmetry.` (beyond the detail already in TIER 2)
- `Dead centre, no tilt, no rotation.` (beyond the angle enforcement already stated)

#### Excessive Knuckle/Bar Detail
- `Natural knuckle definition` (beyond "realistic five fingers")
- `realistic skin compression against the knurled bar surface`

#### Over-emphasis on Prohibition
- `No extra fingers, no fused fingers, no floating hands, no missing thumbs.` (covered by "realistic five fingers")
- `ABSOLUTE PROHIBITION: barbell not visible, barbell floating, barbell disconnected from hands...` (redundant, already stated)

---

## Character Budget Analysis (Current State)

### Current System Message + Prompt Template
- **System message**: ~1,300 lines (RULES 1-11 + construction guides)
- **User message**: ~800 chars (exercise name, equipment, angle, logo description, etc.)
- **Total context**: ~2,100 chars

### Current Problem
- **Image prompt budget**: 2,950 chars (hard limit at KIE API)
- **Video prompt budget**: 2,500 chars (hard limit at Seedance API)
- Claude is instructed "do not exceed 2,900 chars" but user's deadlift prompt is likely **3,500+ chars** when fully detailed

### Truncation Points (Observed)
- User's prompt cuts at: `The barbell rests against the front of both thighs at mid-thigh level, under complete control. The steel bar has visible mass and weight — it appears heavy and substantial, a solid straight horizontal implement extending symmetrically to both sides. From this frontal camera angle, the barbell is centered in the athlete's lower body, a horizontal line crossing the thighs with loaded plates visible on both ends. The bar[CUTS HERE]`
- This is approximately **2,100 chars in**, meaning the FULL deadlift image prompt would be ~3,200+ chars
- The barbell positioning detail (TIER 2/3) is being truncated, but critically: logo and background are BEFORE the cut and should be included

---

## Solution Strategy

### Step 1: Rewrite System Message with Explicit Tiers
Claude will be instructed:
```
TIER 1 (NON-NEGOTIABLE): Format, camera angle, exercise specificity, implement visibility, background, logo, full body framing
TIER 2 (HIGH PRIORITY): Muscle activation detail, bilateral symmetry descriptions, lighting detail
TIER 3 (OPTIMIZABLE): Excessive flourish language, over-emphasis of prohibitions, redundant knuckle detail

If the prompt exceeds 2,900 characters:
1. First, cut TIER 3 content completely
2. Then, if still over, condense TIER 2 (remove flourish adjectives, keep core facts)
3. NEVER cut TIER 1 — if TIER 1 alone exceeds 2,900, return error and alert user
```

### Step 2: Insert Tier Markers in Output
Claude will insert markers at tier boundaries:
```json
{
  "image_prompt": "...TIER 1 CORE CONTENT... [END_TIER_1] ...TIER 2 DETAIL... [END_TIER_2] ...TIER 3 FLOURISH... [END_TIER_3]"
}
```

### Step 3: Smart Truncation in Runtime
```typescript
function truncateSmartly(prompt: string, maxChars: number): string {
  if (prompt.length <= maxChars) return prompt;
  
  const tier2Marker = '[END_TIER_2]';
  const tier1Marker = '[END_TIER_1]';
  
  // Try to truncate at TIER 2 boundary
  const tier2Idx = prompt.lastIndexOf(tier2Marker);
  if (tier2Idx > 0 && tier2Idx < maxChars) {
    const truncated = prompt.substring(0, tier2Idx);
    if (truncated.length <= maxChars) {
      return truncated.replace(tier2Marker, '').trim() + '.';
    }
  }
  
  // Try to truncate at TIER 1 boundary (emergency)
  const tier1Idx = prompt.lastIndexOf(tier1Marker);
  if (tier1Idx > 0 && tier1Idx < maxChars) {
    const truncated = prompt.substring(0, tier1Idx);
    if (truncated.length <= maxChars) {
      return truncated.replace(tier1Marker, '').trim() + '.';
    }
  }
  
  // Last resort: truncate at last sentence
  const lastPeriod = prompt.lastIndexOf('.', maxChars);
  if (lastPeriod > 0) {
    return prompt.substring(0, lastPeriod + 1);
  }
  
  return prompt.substring(0, maxChars);
}
```

### Step 4: Validation
Post-truncation checks:
- ✅ Contains "logo" or "left thigh" (logo check)
- ✅ Contains "white" and "studio" (background check)
- ✅ Contains camera angle keyword (frontal/lateral/posterior)
- ✅ Contains "lockout" and "barbell" (exercise specificity)
- ⚠️ If any TIER 1 check fails, flag for manual review

---

## Character Count Estimates (Deadlift Frontal)

| Tier | Content | Estimated Chars | Priority |
|------|---------|-----------------|----------|
| TIER 1 | Format + Angle + Subject + Lockout Position + Barbell Grip + Background + Logo + Framing | ~1,800 chars | CRITICAL |
| TIER 2 | Muscle Activation + Symmetry Details + Lighting | ~900 chars | HIGH |
| TIER 3 | Excessive Flourish + Over-emphasis | ~400 chars | OPTIONAL |
| **TOTAL** | **Full Detailed Prompt** | **~3,100 chars** | |
| **Target** | **Within API Budget** | **≤ 2,950 chars** | |
| **Margin** | **Budget Shortfall** | **-150 chars** | ⚠️ |

**Conclusion**: TIER 1 (1,800) + TIER 2 condensed (850) = ~2,650 chars → fits within budget by cutting TIER 3 + condensing TIER 2 adjectives.

---

## Next Steps (Implementation)
1. ✅ **PHASE 1 (Complete)**: Analysis and Tier categorization
2. **PHASE 2**: Rewrite claude.ts system message with Tier structure
3. **PHASE 3**: Add tier markers to buildDualPrompts() output
4. **PHASE 4**: Implement truncateSmartly() function
5. **PHASE 5**: Test with deadlift generation and verify logo/background appear
6. **PHASE 6**: Extend framework to all exercises
