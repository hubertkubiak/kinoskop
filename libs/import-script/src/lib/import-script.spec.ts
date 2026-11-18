import { importScript } from './import-script';

describe('importScript', () => {
  it('should work', () => {
    expect(importScript()).toEqual('import-script');
  });
});
