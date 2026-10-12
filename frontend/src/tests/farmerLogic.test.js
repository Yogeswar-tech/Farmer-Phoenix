import test from 'node:test';
import assert from 'node:assert/strict';
import { MANDI_DATABASE, WEATHER_FORECAST, CROP_CHIPS } from '../data/mockData.js';
import { translations } from '../data/i18n.js';

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
  assert.strictEqual(CROP_CHIPS.length, 8, 'Must have 8 crop chips');
  const keys = CROP_CHIPS.map(c => c.key);
  assert.ok(keys.includes('chilli'), 'Must include chilli');
  assert.ok(keys.includes('cotton'), 'Must include cotton');
  assert.ok(keys.includes('paddy'), 'Must include paddy');
});
