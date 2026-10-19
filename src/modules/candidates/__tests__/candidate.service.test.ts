import { AppError } from '../../../lib/errors';
import { FakeCandidateRepository } from '../fake-candidate-repository';
import { CandidateService } from '../candidate.service';

describe('CandidateService.create', () => {
  it('creates a candidate and it appears in list()', async () => {
    const service = new CandidateService(new FakeCandidateRepository());

    const created = await service.create('Ayu Lestari', 'admin-id');

    expect(created).toMatchObject({ name: 'Ayu Lestari' });
    const list = await service.list();
    expect(list).toEqual([{ id: created.id, name: 'Ayu Lestari' }]);
  });

  it('rejects a duplicate name (case/spacing-insensitive) with CANDIDATE_NAME_TAKEN', async () => {
    const service = new CandidateService(new FakeCandidateRepository());
    await service.create('Budi Santoso', 'admin-id');

    await expect(service.create('  BUDI   santoso ', 'admin-id')).rejects.toMatchObject({
      code: 'CANDIDATE_NAME_TAKEN',
      statusCode: 409,
    });
  });

  it('rejects an invalid name with VALIDATION_ERROR, not a 500', async () => {
    const service = new CandidateService(new FakeCandidateRepository());

    await expect(service.create('<script>', 'admin-id')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('rejects an empty name with VALIDATION_ERROR', async () => {
    const service = new CandidateService(new FakeCandidateRepository());

    await expect(service.create('   ', 'admin-id')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('every thrown error is an AppError', async () => {
    const service = new CandidateService(new FakeCandidateRepository());
    await service.create('Taken Name', 'admin-id');

    try {
      await service.create('taken name', 'admin-id');
      throw new Error('expected service.create to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
    }
  });
});
