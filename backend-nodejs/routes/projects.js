// routes/projects.js
const express = require('express');
const router = express.Router();
const ProjectController = require('../controllers/projectController');
const { authenticateToken, canCreateProject } = require('../middleware/auth');

// Route de debug temporaire pour tester la création de projet
router.post('/debug-create', authenticateToken, async (req, res) => {
  try {
    const { query } = require('../config/database');
    
    console.log('🐛 DEBUG - Body reçu:', req.body);
    console.log('🐛 DEBUG - User info:', req.user);
    
    // Test 1: Vérifier les tables de référence
    const statuses = await query('SELECT * FROM statuts_projet');
    const directions = await query('SELECT * FROM directions');
    const users = await query('SELECT id, nom FROM utilisateurs WHERE statut = "Actif"');
    
    console.log('🐛 DEBUG - Statuts trouvés:', statuses.length);
    console.log('🐛 DEBUG - Directions trouvées:', directions.length);
    console.log('🐛 DEBUG - Utilisateurs trouvés:', users.length);
    
    // Test 2: Essayer de créer un projet simple
    const testProject = {
      nom: `Test Debug ${new Date().getTime()}`,
      description: 'Projet de test pour debug',
      chef_projet_id: req.user.userId,
      direction_id: directions[0]?.id || 1,
      statut_id: statuses[0]?.id || 1,
      pourcentage_avancement: 0,
      priorite: 'Normale'
    };
    
    console.log('🐛 DEBUG - Tentative de création avec:', testProject);
    
    const result = await query(`
      INSERT INTO projets (nom, description, chef_projet_id, direction_id, statut_id, pourcentage_avancement, priorite, created_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      testProject.nom,
      testProject.description,
      testProject.chef_projet_id,
      testProject.direction_id,
      testProject.statut_id,
      testProject.pourcentage_avancement,
      testProject.priorite
    ]);
    
    console.log('🐛 DEBUG - Résultat insertion:', result);
    
    // Test 3: Vérifier que le projet a été créé
    const verification = await query('SELECT * FROM projets WHERE id = ?', [result.insertId]);
    console.log('🐛 DEBUG - Vérification projet créé:', verification);
    
    // Test 4: Tester la requête de récupération complète
    const fullQuery = await query(`
      SELECT p.*, 
             u.nom as chef_projet_nom,
             d.nom as direction_nom,
             s.nom as statut_nom,
             s.couleur as statut_couleur
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      WHERE p.id = ?
    `, [result.insertId]);
    
    res.json({
      success: true,
      debug_info: {
        statuses_count: statuses.length,
        directions_count: directions.length,
        users_count: users.length,
        created_project_id: result.insertId,
        project_verification: verification[0],
        full_project_query: fullQuery[0]
      }
    });
    
  } catch (error) {
    console.error('🐛 DEBUG - Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// GET /api/projects - Récupérer tous les projets (filtré selon les permissions)
router.get('/', authenticateToken, ProjectController.getAllProjects);

// GET /api/projects/stats - Statistiques des projets
router.get('/stats', authenticateToken, ProjectController.getProjectStats);

// GET /api/projects/recent - Projets récents
router.get('/recent', authenticateToken, ProjectController.getRecentProjects);

// GET /api/projects/dashboard - Tableau de bord des projets
router.get('/dashboard', authenticateToken, ProjectController.getDashboard);

// GET /api/projects/:id - Récupérer un projet par ID
router.get('/:id', authenticateToken, ProjectController.getProjectById);

// POST /api/projects - Créer un nouveau projet (Admin et PMO seulement)
router.post('/', authenticateToken, canCreateProject, ProjectController.createProject);

// PUT /api/projects/:id - Mettre à jour un projet (selon permissions)
router.put('/:id', authenticateToken, ProjectController.updateProject);

// DELETE /api/projects/:id - Supprimer un projet (Admin et PMO seulement)
router.delete('/:id', authenticateToken, canCreateProject, ProjectController.deleteProject);

module.exports = router;