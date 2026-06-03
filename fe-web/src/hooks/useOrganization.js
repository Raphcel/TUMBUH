import { useCallback, useEffect, useMemo, useState } from 'react';
import { organizationsApi } from '../api/organizations';

export function useOrganization() {
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshOrganization = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await organizationsApi.me();
      setOrganization(data);
      return data;
    } catch (err) {
      setError(err);
      setOrganization(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshOrganization();
  }, [refreshOrganization]);

  return useMemo(() => {
    const membership = organization?.membership || null;
    const permissions = membership?.permissions || [];
    return {
      organization,
      company: organization?.company || null,
      membership,
      members: organization?.members || [],
      permissions,
      onboardingRequired: organization?.onboarding_required !== false && !organization?.company,
      loading,
      error,
      refreshOrganization,
      can: (permission) => permissions.includes(permission),
    };
  }, [error, loading, organization, refreshOrganization]);
}

export default useOrganization;
