import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCardNetwork,
  formatCardNumber,
  formatExpiry,
  validateCardExpiry,
  validateCvv,
  validateLuhnChecksum,
  validateUpiId,
} from './paymentValidation';

test('validateLuhnChecksum accepts valid Luhn card numbers and rejects invalid ones', () => {
  assert.equal(validateLuhnChecksum('4532 0151 1283 0366'), true);
  assert.equal(validateLuhnChecksum('4532 0151 1283 0367'), false);
  assert.equal(validateLuhnChecksum('1234'), false);
});

test('detectCardNetwork identifies Visa, Mastercard, Amex, and RuPay networks', () => {
  assert.equal(detectCardNetwork('4532 0151 1283 0366'), 'Visa');
  assert.equal(detectCardNetwork('5425 2334 3010 9903'), 'Mastercard');
  assert.equal(detectCardNetwork('3782 822463 10005'), 'Amex');
  assert.equal(detectCardNetwork('6073 8400 1234 5678'), 'RuPay');
  assert.equal(detectCardNetwork('6521 5000 1234 5678'), 'RuPay');
});

test('formatCardNumber and formatExpiry format user input cleanly', () => {
  assert.equal(formatCardNumber('4532015112830366'), '4532 0151 1283 0366');
  assert.equal(formatExpiry('0829'), '08/29');
});

test('validateCardExpiry enforces future MM/YY dates', () => {
  assert.equal(validateCardExpiry('12/32'), true);
  assert.equal(validateCardExpiry('13/29'), false);
  assert.equal(validateCardExpiry('01/20'), false);
});

test('validateCvv checks 3 digits for standard networks and 4 digits for Amex', () => {
  assert.equal(validateCvv('742', 'Visa'), true);
  assert.equal(validateCvv('7429', 'Visa'), false);
  assert.equal(validateCvv('7429', 'Amex'), true);
  assert.equal(validateCvv('742', 'Amex'), false);
});

test('validateUpiId validates standard NPCI VPA handles', () => {
  assert.equal(validateUpiId('nivora.member@okhdfcbank'), true);
  assert.equal(validateUpiId('9876543210@ybl'), true);
  assert.equal(validateUpiId('invalid-vpa-without-at'), false);
  assert.equal(validateUpiId('@missinghandle'), false);
});
