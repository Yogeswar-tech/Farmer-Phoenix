import test from 'node:test';
import assert from 'node:assert/strict';
import { MANDI_DATABASE, WEATHER_FORECAST, CROP_CHIPS, AGRICULTURAL_LOCATIONS } from '../data/mockData.ts';
import { translations } from '../data/i18n.ts';

test('1. Verified Multi-Grade Price Structure for Chilli', () => {
  const guntur = MANDI_DATABASE.find(m => m.cropKey === 'chilli');
  assert.ok(guntur, 'Guntur Chilli data must exist');
  assert.strictEqual(guntur.grades.length >= 3, true, 'Must have at least 3 distinct grades');

  const teja = guntur.grades.find(g => g.gradeCode === 'A');
  const modal = guntur.grades.find(g => g.gradeCode === 'MODAL');
  const tala = guntur.grades.find(g => g.gradeCode === 'C');

  assert.ok(teja && modal && tala, 'Must contain Teja, Modal, and Tala grades');
  assert.ok(teja.maxPrice > modal.modalPrice, 'Teja premium price must be greater than modal rate');
  assert.ok(modal.modalPrice > tala.minPrice, 'Modal price must be higher than Tala lower grade rate');
  assert.strictEqual(tala.minPrice, 7500, 'Tala lower grade minimum price is ₹7,500');
});

test('2. "Why Sell?" Decision Rationale Verification', () => {
  const guntur = MANDI_DATABASE.find(m => m.cropKey === 'chilli');
  assert.ok(guntur, 'Guntur must exist');
  assert.strictEqual(guntur.priceTrend.diffLastWeek, 300, 'Must record ₹300 difference above last week');
  assert.strictEqual(guntur.whySellReasons.trendReason.hi.includes('₹300'), true);
  assert.strictEqual(guntur.whySellReasons.weatherReason.hi.includes('गुरुवार'), true, 'Must flag Thursday rain');
  assert.strictEqual(guntur.whySellReasons.inflowReason.hi.includes('18%'), true, 'Must flag 18% lower inflows');
});

test('3. Weather Risk & Thursday Rain Spray Warning', () => {
  const thursday = WEATHER_FORECAST.find(w => w.dayName.en.includes('Thursday'));
  assert.ok(thursday, 'Thursday weather forecast must exist');
  assert.strictEqual(thursday.riskLevel, 'danger', 'Thursday must be classified as danger risk');
  assert.ok(thursday.rainChance >= 80, 'Thursday rain probability must be >= 80%');
  assert.strictEqual(thursday.sprayingAdvice.hi.includes('कोई छिड़काव न करें'), true);
});

test('4. Anonymous Zero-State (No hardcoded "Ramesh")', () => {
  const hiWelcome = translations.hi.namaste;
  const enWelcome = translations.en.namaste;
  assert.strictEqual(hiWelcome.includes('Ramesh'), false, 'Hindi welcome must NOT have Ramesh');
  assert.strictEqual(enWelcome.includes('Ramesh'), false, 'English welcome must NOT have Ramesh');
  assert.strictEqual(translations.hi.guestFarmer.includes('Guest'), true);
});

test('5. Visual Crop Chips Coverage', () => {
  assert.ok(CROP_CHIPS.length >= 8, 'Must have at least 8 crop chips');
  const keys = CROP_CHIPS.map(c => c.key);
  assert.ok(keys.includes('chilli'), 'Must include chilli');
  assert.ok(keys.includes('cotton'), 'Must include cotton');
  assert.ok(keys.includes('paddy'), 'Must include paddy');
});

test('6. Strict English Localization Check (No Devanagari Hindi Bleed)', () => {
  // Regex to check Devanagari script: \u0900-\u097F
  const devanagariRegex = /[\u0900-\u097F]/;
  const enKeys = Object.keys(translations.en);
  for (const k of enKeys) {
    const val = translations.en[k];
    assert.strictEqual(
      devanagariRegex.test(val),
      false,
      `Key "${k}" in English translations must not contain Devanagari characters: "${val}"`
    );
  }

  // Also check English grades
  const guntur = MANDI_DATABASE.find(m => m.cropKey === 'chilli');
  if (guntur) {
    for (const g of guntur.grades) {
      assert.strictEqual(
        devanagariRegex.test(g.name.en),
        false,
        `Grade name "${g.name.en}" must not contain Devanagari`
      );
      assert.strictEqual(
        devanagariRegex.test(g.qualityCriteria.en),
        false,
        `Grade criteria "${g.qualityCriteria.en}" must not contain Devanagari`
      );
    }
  }
});

test("7. Today's Price & Location System Verification", () => {
  assert.strictEqual(translations.en.tabRates, "Today's Price", 'English tab must be Today\'s Price');
  assert.strictEqual(translations.hi.tabRates, 'आज का भाव', 'Hindi tab must be आज का भाव');
  assert.strictEqual(translations.te.tabRates, 'ఈరోజు ధరలు', 'Telugu tab must be ఈరోజు ధరలు');
  assert.ok(translations.en.climateSearchBtn, 'Climate search button must exist');
  assert.ok(translations.en.selectLocationTitle, 'Select location title must exist');
});

test('8. Educational Charts Module & Multi-Grade Quality Structure', () => {
  assert.ok(translations.en.tabCharts, 'English tabCharts must exist');
  assert.strictEqual(translations.en.tabCharts, 'Educational Charts');
  assert.ok(translations.hi.tabCharts, 'Hindi tabCharts must exist');
  assert.ok(translations.te.tabCharts, 'Telugu tabCharts must exist');
  assert.ok(translations.en.educationalChartsTitle, 'Educational charts title must exist');
  assert.ok(translations.en.educationalChartsDesc, 'Educational charts description must exist');
});

test('9. AI Voice Assistant Mode & Enable Toggle Localization', () => {
  assert.ok(translations.en.aiAssistantMode, 'aiAssistantMode must exist in English');
  assert.strictEqual(translations.en.aiAssistantMode, 'AI Voice Assistant Mode');
  assert.ok(translations.en.aiAssistantEnable, 'aiAssistantEnable must exist');
  assert.ok(translations.en.aiAssistantActive, 'aiAssistantActive must exist');
  assert.ok(translations.en.voiceAssistantTitle, 'voiceAssistantTitle must exist');
  assert.ok(translations.hi.aiAssistantEnable, 'Hindi aiAssistantEnable must exist');
});

test('10. Auto GPS & Structured Location Details (No Map View)', () => {
  const guntur = AGRICULTURAL_LOCATIONS.find(l => l.id === 'guntur');
  assert.ok(guntur, 'Guntur location option must exist');
  assert.ok(guntur.name.en, 'Must have name');
  assert.ok(guntur.district.en, 'Must have district');
  assert.ok(guntur.state.en, 'Must have state');
  assert.ok(guntur.pincode, 'Must have postal PIN code');

  // Verify location structure format contains all details for display without map view
  assert.strictEqual(typeof guntur.name.hi, 'string');
  assert.strictEqual(typeof guntur.district.te, 'string');
  assert.strictEqual(guntur.pincode, '522001');
});


