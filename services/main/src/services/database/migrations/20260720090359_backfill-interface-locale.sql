-- Preserve the old first-language UI preference after interface locale becomes independent.
UPDATE profile_preference
SET interface_locale = CASE
    WHEN preferred_languages[1] = 'en' THEN 'en'
    ELSE 'zh-hant'
END;
