-- Remove seeded legal-document copy. Administrators manage these documents in D1.
UPDATE systemSettings
SET value = '', updatedAt = CURRENT_TIMESTAMP
WHERE key IN ('userTerms', 'rentalTerms', 'serviceTerms', 'privacyPolicy', 'softwareTerms', 'copyrightNotice');
