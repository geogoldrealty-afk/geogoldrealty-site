import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCompact } from '../api/_lib/rets.js';

test('compact parser aligns rental columns when the row includes a leading RETS delimiter', () => {
  const response = '<RETS ReplyCode="0" ReplyText="Success"><DELIMITER value="09"/><COLUMNS>LISTINGID\tSTREETNUMDISPLAY\tSTREETNAME\tCITY\tRENTPRICE</COLUMNS><DATA>\t4050001\t12\tRental Way\tLyndhurst\t2800\t</DATA></RETS>';
  assert.deepEqual(parseCompact(response), [{
    LISTINGID: '4050001',
    STREETNUMDISPLAY: '12',
    STREETNAME: 'Rental Way',
    CITY: 'Lyndhurst',
    RENTPRICE: '2800'
  }]);
});

test('compact parser honors the provider-advertised delimiter', () => {
  const response = '<RETS><DELIMITER value="124"/><COLUMNS>LISTINGID|CITY|RENTPRICE</COLUMNS><DATA>|4050002|Rutherford|3100|</DATA></RETS>';
  assert.deepEqual(parseCompact(response), [{ LISTINGID: '4050002', CITY: 'Rutherford', RENTPRICE: '3100' }]);
});
