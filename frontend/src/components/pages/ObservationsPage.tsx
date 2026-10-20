import React from 'react';
import { LongitudinalChart } from '../charts/LongitudinalChart';
import { PatientTimeline } from '../timeline/PatientTimeline';

export const ObservationsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <LongitudinalChart />
      <PatientTimeline />
    </div>
  );
};
