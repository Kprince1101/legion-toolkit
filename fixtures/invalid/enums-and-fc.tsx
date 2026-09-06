import type { FC } from 'react';
import React from 'react';

enum LeadStatus {
  Unclaimed,
  Claimed,
}

export const LeadBadge: FC<{ status: LeadStatus }> = ({ status }) => (
  <span>{status}</span>
);

export const LeadRow: React.FunctionComponent<{ id: string }> = ({ id }) => (
  <tr>
    <td>{id}</td>
  </tr>
);
