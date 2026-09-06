import { useState } from 'react';

export const useSaveDraft = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  return { isLoading, error, success, setIsLoading, setError, setSuccess };
};
