import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('rental search is routed to the GSMLS rental class', async () => {
  const source = await readFile(new URL('../api/idx/listings.js', import.meta.url), 'utf8');
  assert.match(source, /Class:market === 'rent' \? 'RNT' : 'RES'/);
  assert.match(source, /priceField='LISTPRICE'/);
  assert.match(source, /Select:'LISTINGID,LISTINGSTATUS,' \+ priceField \+ ',STREETNUMDISPLAY,STREETNAME,CITY,COUNTY,POSTALCODE,BEDS,BATHS,SUBPROPTYPE,LISTOFFICEID,LISTOFFICENAME,LISTOFFICEPHONE,LASTMODIFIED'/);
});
