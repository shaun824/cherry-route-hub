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
});