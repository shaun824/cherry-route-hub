import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { excludeResultRows, isResultExcluded } from './result-exclusions';

const exclusions = [{ name: 'Noemi Pestana', bib: '714' }];
describe('approved Lourensford result exclusion', () => {
  it('excludes Noemi Pestana bib 714 and matches her roster without a bib', () => {
    assert.equal(isResultExcluded({ full_name: 'Noemi Pestana', bib_number: '714' }, exclusions), true);
    assert.equal(isResultExcluded({ name: 'Noemi Pestana', bib: null }, exclusions), true);
    assert.equal(isResultExcluded({ full_name: 'Another rider', bib_number: '715' }, exclusions), false);
  });
  it('removes the result and moves the following rider up without mutating source records', () => {
    const rows = [{ full_name: 'Noemi Pestana', bib_number: '714', result_set_id: 'gold', position: 2 }, { full_name: 'Next rider', bib_number: '715', result_set_id: 'gold', position: 3 }];
    assert.deepEqual(excludeResultRows(rows, exclusions).map(row => [row.bib_number, row.position]), [['715', 2]]);
    assert.equal(rows[1].position, 3);
  });
  it('does not apply another event’s exclusions', () => {
    assert.equal(isResultExcluded({ name: 'Noemi Pestana', bib: '714' }, []), false);
  });
  it('moves the third Gold woman to second after Noemi is excluded, preserving source timing and ranks', () => {
    const rows = [
      { full_name: 'Noemi Pestana', bib_number: '714', result_set_id: 'gc', position: 17, extras: { Gender: 'F', 'Gender Place': '2' }, time_text: '5:18:13.31' },
      { full_name: 'Following woman', bib_number: '715', result_set_id: 'gc', position: 25, extras: { Gender: 'F', 'Gender Place': '3' }, time_text: '5:31:21.96' },
      { full_name: 'Male rider', bib_number: '716', result_set_id: 'gc', position: 26, extras: { Gender: 'M', 'Gender Place': '3' }, time_text: '5:32:00' },
      { full_name: 'Other day', bib_number: '715', result_set_id: 'day1', position: 40, extras: { Gender: 'F', 'Gender Place': '4' }, time_text: '2:43:28.9' },
    ];
    const adjusted = excludeResultRows(rows, exclusions);
    assert.equal(adjusted[0].extras['Gender Place'], '2');
    assert.equal(adjusted[0].position, 24);
    assert.equal(adjusted[0].time_text, '5:31:21.96');
    assert.equal(adjusted[1].extras['Gender Place'], '3');
    assert.equal(adjusted[2].extras['Gender Place'], '4');
    assert.equal(rows[1].extras['Gender Place'], '3');
  });
});