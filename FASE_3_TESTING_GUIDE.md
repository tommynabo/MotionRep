# FASE 3: Testing & Validation Guide

## Objectives
1. Verify that TIER markers are being inserted by Claude
2. Confirm logo and background are preserved in final prompts
3. Test real image/video generation to verify visual output
4. Identify any remaining truncation issues

## Testing Steps

### Step 1: Test Prompt Generation (No Credits Spent)
Use the `/api/test-prompts` endpoint to generate prompts without spending KIE credits.

**Example cURL request:**
```bash
curl -X POST http://localhost:3000/api/test-prompts \
  -H "Content-Type: application/json" \
  -d '{
    "exercise_id": "deadlift-conventional-id",
    "angle_id": "frontal-angle-id",
    "user_observations": "Perfect lockout position, zero deviation"
  }'
```

**Expected Response Structure:**
```json
{
  "imagePrompt": "High quality commercial fitness photography...[END_TIER_1]...muscle activation details...[END_TIER_2]...flourish language...[END_TIER_3]",
  "videoPrompt": "ULTRA STATIC LOCKED CAMERA....[END_TIER_1]...cable physics...[END_TIER_2]...optional details...[END_TIER_3]",
  "meta": {
    "imagePromptLength": 2847,
    "videoPromptLength": 2312,
    "imagePromptBudget": 2950,
    "videoPromptBudget": 2500,
    "imagePromptOk": true,
    "videoPromptOk": true,
    "exerciseName": "Conventional Deadlift",
    "cameraAngle": "Frontal",
    "checks": {
      "shirtless": true,
      "logo": true,
      "whiteBackground": true,
      "seamlessContinuity": true,
      "tenSeconds": true,
      "fourReps": true
    },
    "tierBreakdown": {
      "image": {
        "tier1Chars": 1847,
        "tier1Percentage": 63,
        "budgetRemaining": 103
      },
      "video": {
        "tier1Chars": 1512,
        "tier1Percentage": 60,
        "budgetRemaining": 188
      }
    }
  }
}
```

### Step 2: Validate TIER Markers
```bash
# Check if TIER markers are present
grep -o '\[END_TIER_[1-3]\]' <<< "$imagePrompt" | wc -l
# Expected: 3 (one for each tier)

# Check that logo appears BEFORE [END_TIER_1]
grep -b -o '\[END_TIER_1\]' <<< "$imagePrompt"
grep -b -o 'logo\|left thigh' <<< "$imagePrompt"
# Expected: logo/left thigh position < [END_TIER_1] position
```

### Step 3: Validate Critical TIER 1 Content
Verify all TIER 1 elements are present:
```bash
# Should all return true (1)
echo "$imagePrompt" | grep -i 'white studio' | wc -l
echo "$imagePrompt" | grep -i 'camera angle\|frontal\|lateral\|posterior' | wc -l
echo "$imagePrompt" | grep -i 'barbell.*gripped\|grip.*firmly' | wc -l
echo "$imagePrompt" | grep -i 'logo.*left thigh\|left thigh.*logo' | wc -l
echo "$imagePrompt" | grep -i 'full body.*visible\|entire body' | wc -l

# Video checks
echo "$videoPrompt" | grep -i 'ULTRA STATIC LOCKED CAMERA' | wc -l
echo "$videoPrompt" | grep -i 'ZERO cuts\|zero cuts' | wc -l
echo "$videoPrompt" | grep -i 'logo.*left thigh\|left thigh.*logo' | wc -l
```

### Step 4: Test Real Generation (With Credits)
Once prompts are validated, generate a real image/video to verify visual output.

**POST /api/generate**
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "exercise_id": "deadlift-conventional-id",
    "angle_id": "frontal-angle-id"
  }'
```

**Expected Result:**
- Image 1 (GPT Image base): Should show athlete, barbell at mid-thigh, white background
- Image 2 (Flux face-swap): Same as Image 1 with face replaced
- Image 3 (Flux logo placement): Same with logo visible on left thigh outer
- Video: 4 continuous deadlift reps at lockout position with visible logo

### Step 5: Visual Verification Checklist
After generation, verify:

**Image Checks:**
- [ ] Athlete visible with shirtless torso
- [ ] Barbell clearly held at mid-thigh height
- [ ] Both hands gripping the barbell with visible fingers
- [ ] White studio background (walls, floor, ceiling lights)
- [ ] Logo visible on left thigh outer face (3cm × 3cm area)
- [ ] Full body visible (head to feet)
- [ ] Bilateral symmetry in frontal view

**Video Checks:**
- [ ] Static camera (no zoom, panning, or scene changes)
- [ ] Athlete performs 4 continuous deadlift repetitions
- [ ] Reps are continuous without cuts (0s-10s total)
- [ ] Logo remains visible on left thigh throughout all frames
- [ ] White background consistent across all frames
- [ ] Barbell visible and gripped in all frames

## Troubleshooting

### Issue: Logo not visible in generated images
**Possible Causes:**
1. **Claude not inserting marker**: Check testPromptsController response — does `[END_TIER_1]` marker appear?
2. **Logo text is too long**: Check if logo description exceeds available space in TIER 1
3. **KIE API not rendering**: The prompt may be correct but GPT Image/Flux API not interpreting the logo instruction

**Resolution:**
- If marker missing: Claude may be defaulting to old system message. Verify system message was updated in buildDualPrompts().
- If logo description long: Try condensing logo description in config (table: config, key: 'shorts_logo_description')
- If API not rendering: Test by manually creating a simple test image prompt with explicit logo instruction to KIE

### Issue: Background is not white studio
**Possible Causes:**
1. RULE 1 is being truncated
2. User observations overriding background instruction
3. KIE API is interpreting "white studio" differently

**Resolution:**
- Verify RULE 1 is in TIER 1 and appears before [END_TIER_1] marker
- Check truncation warnings in server logs
- Test with a minimal prompt that ONLY specifies white background

### Issue: Prompts still being truncated mid-sentence
**Possible Causes:**
1. Claude is not inserting [END_TIER_X] markers
2. truncateSmart() function is not being called
3. TIER 1 content itself exceeds 2,950 chars for image or 2,500 for video

**Resolution:**
- Add logging to truncateSmart() function to verify it's being called
- Check Claude's raw JSON output in parseand see if markers are present
- If TIER 1 alone exceeds budget: This is a critical error — may need to review what qualifies as TIER 1

## Performance Expectations

### Character Budget Analysis
**Conventional Deadlift (Frontal View):**
- TIER 1: ~1,850 chars (63% of image budget)
- TIER 2: ~800 chars (additional details)
- TIER 3: ~350 chars (flourish)
- **Total**: ~3,000 chars → Optimized to ~2,650 (fits budget)

**Conventional Deadlift Video:**
- TIER 1: ~1,500 chars (60% of video budget)
- TIER 2: ~650 chars (cable physics if applicable)
- TIER 3: ~200 chars (optional)
- **Total**: ~2,350 chars (fits comfortably within budget)

## Success Criteria
✅ FASE 3 is successful when:
1. TIER markers appear in ALL generated prompts
2. Logo is visible in 100% of test generations
3. White background is visible in 100% of test generations
4. Video shows uninterrupted 4 reps with no cuts
5. No emergency truncation warnings in server logs
6. tierBreakdown metadata is accurate within ±2%
