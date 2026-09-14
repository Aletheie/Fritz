import { caseFileById } from '$lib/domain/cases/catalog.ts';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
  const caseFile = caseFileById(params.caseId);
  if (!caseFile) error(404, 'Případ nebyl nalezen. / Case not found.');
  return { caseFile };
};
