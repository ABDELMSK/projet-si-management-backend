// models/Project.js
const { query } = require('../config/database');

class Project {
  // Créer un nouveau projet
  static async create(projectData) {
  try {
    const {
      nom, description, chef_projet_id, direction_id, statut_id,
      budget, date_debut, date_fin_prevue, priorite
    } = projectData;
    
    // Log pour debug
    console.log('🔄 Création de projet avec données:', projectData);
    
    const sql = `
      INSERT INTO projets (
        nom, description, chef_projet_id, direction_id, statut_id, 
        budget, date_debut, date_fin_prevue, priorite, pourcentage_avancement, created_at
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
    `;
    
    const params = [
      nom, 
      description || null, 
      chef_projet_id, 
      direction_id, 
      statut_id,
      budget || null, 
      date_debut || null, 
      date_fin_prevue || null, 
      priorite || 'Normale'
    ];
    
    console.log('🔄 Exécution SQL:', sql);
    console.log('🔄 Paramètres:', params);
    
    const result = await query(sql, params);
    
    console.log('✅ Projet créé avec ID:', result.insertId);
    
    // Vérification immédiate
    const verification = await query('SELECT * FROM projets WHERE id = ?', [result.insertId]);
    console.log('✅ Vérification en base:', verification[0]);
    
    return result.insertId;
    
  } catch (error) {
    console.error('❌ Erreur lors de la création du projet:', error);
    console.error('❌ Stack trace:', error.stack);
    throw error;
  }
}
  // Récupérer tous les projets (avec permissions)
  static async findAll(userId = null, userRole = null) {
    let sql = `
      SELECT p.*, 
             u.nom as chef_projet_nom,
             d.nom as direction_nom,
             s.nom as statut_nom,
             s.couleur as statut_couleur,
             COUNT(t.id) as nb_taches,
             COALESCE(AVG(CASE WHEN t.statut = 'Terminé' THEN 1 ELSE 0 END) * 100, 0) as taches_completees_pct
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      LEFT JOIN taches t ON p.id = t.projet_id
    `;
    
    const params = [];
    
    // Filtrer selon le rôle et les permissions
    if (userRole === 'Chef de Projet' && userId) {
      sql += ' WHERE p.chef_projet_id = ?';
      params.push(userId);
    }
    // Admin et PMO voient tous les projets (pas de WHERE)
    
    sql += ' GROUP BY p.id ORDER BY p.updated_at DESC';
    
    return await query(sql, params);
  }

  // Trouver un projet par ID (avec vérification des permissions)
  static async findById(id, userId = null, userRole = null) {
    const sql = `
      SELECT p.*, 
             u.nom as chef_projet_nom,
             u.email as chef_projet_email,
             d.nom as direction_nom,
             s.nom as statut_nom,
             s.couleur as statut_couleur,
             COUNT(t.id) as nb_taches,
             COUNT(CASE WHEN t.statut = 'Terminé' THEN 1 END) as taches_terminees
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      LEFT JOIN taches t ON p.id = t.projet_id
      WHERE p.id = ?
      GROUP BY p.id
    `;
    
    const results = await query(sql, [id]);
    const project = results[0] || null;
    
    if (!project) return null;
    
    // Vérifier les permissions d'accès
    if (userRole === 'Chef de Projet' && project.chef_projet_id !== userId) {
      return null; // Le chef de projet ne peut voir que ses projets
    }
    
    return project;
  }

  // Mettre à jour un projet
  static async update(id, projectData, userId = null, userRole = null) {
    // Vérifier les permissions avant la mise à jour
    const project = await this.findById(id, userId, userRole);
    if (!project) return false;
    
    // Vérifier les permissions de modification
    if (!this.canModify(project, userId, userRole)) {
      return false;
    }
    
    const fields = [];
    const values = [];
    
    // Construire la requête dynamiquement
    Object.keys(projectData).forEach(key => {
      if (projectData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(projectData[key]);
      }
    });
    
    if (fields.length === 0) return false;
    
    values.push(id);
    const sql = `UPDATE projets SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    
    const result = await query(sql, values);
    return result.affectedRows > 0;
  }

  // Supprimer un projet
  static async delete(id, userId = null, userRole = null) {
    // Seuls les admins et PMO peuvent supprimer
    if (!['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(userRole)) {
      return false;
    }
    
    const sql = 'DELETE FROM projets WHERE id = ?';
    const result = await query(sql, [id]);
    return result.affectedRows > 0;
  }

  // Vérifier si un utilisateur peut modifier un projet
  static canModify(project, userId, userRole) {
    if (userRole === 'Administrateur fonctionnel') return true;
    if (userRole === 'PMO / Directeur de projets') return true;
    if (userRole === 'Chef de Projet' && project.chef_projet_id === userId) return true;
    return false;
  }

  // Rechercher des projets
  static async search(searchTerm, userId = null, userRole = null) {
    let sql = `
      SELECT p.*, 
             u.nom as chef_projet_nom,
             d.nom as direction_nom,
             s.nom as statut_nom,
             s.couleur as statut_couleur
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      WHERE (p.nom LIKE ? OR p.description LIKE ?)
    `;
    
    const params = [`%${searchTerm}%`, `%${searchTerm}%`];
    
    // Filtrer selon le rôle
    if (userRole === 'Chef de Projet' && userId) {
      sql += ' AND p.chef_projet_id = ?';
      params.push(userId);
    }
    
    sql += ' ORDER BY p.nom ASC';
    
    return await query(sql, params);
  }

  // Statistiques des projets
  static async getStats(userId = null, userRole = null) {
    let sql = `
      SELECT 
        COUNT(*) as total_projets,
        COUNT(CASE WHEN s.nom = 'En cours' THEN 1 END) as projets_en_cours,
        COUNT(CASE WHEN s.nom = 'Terminé' THEN 1 END) as projets_termines,
        COUNT(CASE WHEN s.nom = 'En pause' THEN 1 END) as projets_en_pause,
        AVG(p.pourcentage_avancement) as avancement_moyen,
        SUM(p.budget) as budget_total
      FROM projets p
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
    `;
    
    const params = [];
    
    // Filtrer selon le rôle
    if (userRole === 'Chef de Projet' && userId) {
      sql += ' WHERE p.chef_projet_id = ?';
      params.push(userId);
    }
    
    const results = await query(sql, params);
    return results[0];
  }

  // Récupérer les projets récents
  static async getRecent(limit = 5, userId = null, userRole = null) {
    let sql = `
      SELECT p.id, p.nom, p.pourcentage_avancement, s.nom as statut_nom, s.couleur as statut_couleur,
             u.nom as chef_projet_nom, p.updated_at
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
    `;
    
    const params = [];
    
    // Filtrer selon le rôle
    if (userRole === 'Chef de Projet' && userId) {
      sql += ' WHERE p.chef_projet_id = ?';
      params.push(userId);
    }
    
    sql += ' ORDER BY p.updated_at DESC LIMIT ?';
    params.push(limit);
    
    return await query(sql, params);
  }

  // Récupérer les projets par statut
  static async getByStatus(statusName, userId = null, userRole = null) {
    let sql = `
      SELECT p.*, u.nom as chef_projet_nom, d.nom as direction_nom, s.nom as statut_nom
      FROM projets p
      LEFT JOIN utilisateurs u ON p.chef_projet_id = u.id
      LEFT JOIN directions d ON p.direction_id = d.id
      LEFT JOIN statuts_projet s ON p.statut_id = s.id
      WHERE s.nom = ?
    `;
    
    const params = [statusName];
    
    // Filtrer selon le rôle
    if (userRole === 'Chef de Projet' && userId) {
      sql += ' AND p.chef_projet_id = ?';
      params.push(userId);
    }
    
    sql += ' ORDER BY p.nom ASC';
    
    return await query(sql, params);
  }
}

module.exports = Project;