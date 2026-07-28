Traitez le jeton comme un mot de passe. Une transmission sûre maintient le secret hors de la conversation avec l’IA.

1. L’agent demande un espace de travail dédié et explique quels fichiers et quelles commandes il utilisera.
2. L’agent peut créer un fichier `.env` vide et l’ajouter à `.gitignore`, mais il s’arrête avant toute saisie d’identifiant.
3. L’utilisateur saisit `REZICS_API_TOKEN` localement. Ne collez pas le jeton dans une conversation avec une IA : le communiquer directement à une IA crée un risque de divulgation inévitable.
4. Le code lit le jeton uniquement depuis l’environnement du processus. Il ne doit jamais l’afficher, l’inclure dans une URL, l’écrire dans des journaux ni le valider dans le dépôt.
5. Commencez avec le plus petit ensemble d’autorisations et la politique Standard. Le point de terminaison sûr d’auto-inspection du jeton peut indiquer l’identité, les autorisations et les limites effectives sans renvoyer le jeton ni aucun autre secret.
6. L’automatisation utilise des lots limités, des points de contrôle et une temporisation progressive. L’utilisateur désactive ou révoque le jeton lorsque la tâche est terminée.
