/**
 * Reports Service — Maps to POST /reports
 */
import api from './api';
import { CreateReportDto } from '../types';

export const reportsService = {
  /** POST /reports */
  create(dto: CreateReportDto): Promise<any> {
    return api.post('/reports', dto);
  },
};
