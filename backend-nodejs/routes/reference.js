// routes/reference.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

// GET /api/reference/directions - Récupérer toutes les directions
router.get('/directions', authenticateToken, async (req, res) => {
  try {
    const directions = await query('SELECT * FROM directions ORDER BY nom');
    res.json({
      success: true,
      data: directions
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des directions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/reference/roles - Récupérer tous les rôles
router.get('/roles', authenticateToken, async (req, res) => {
  try {
    const roles = await query('SELECT * FROM roles ORDER BY nom');
    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des rôles:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/reference/project-statuses - Récupérer tous les statuts de projet
router.get('/project-statuses', authenticateToken, async (req, res) => {
  try {
    const statuses = await query('SELECT * FROM statuts_projet ORDER BY ordre');
    res.json({
      success: true,
      data: statuses
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des statuts:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

// GET /api/reference/users/chefs-projets - Récupérer les utilisateurs pouvant être chefs de projet
router.get('/users/chefs-projets', authenticateToken, async (req, res) => {
  try {
    const chefsProjectsQuery = `
      SELECT u.id, u.nom, u.email, r.nom as role_nom
      FROM utilisateurs u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.statut = 'Actif' 
      AND r.nom IN ('Chef de Projet', 'PMO / Directeur de projets', 'Administrateur fonctionnel')
      ORDER BY u.nom
    `;
    
    const chefsProjets = await query(chefsProjectsQuery);
    
    res.json({
      success: true,
      data: chefsProjets
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des chefs de projet:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
});

module.exports = router;