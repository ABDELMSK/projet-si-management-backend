// controllers/projectController.js
const Project = require('../models/Project');

class ProjectController {
  // Récupérer tous les projets (avec permissions)
  static async getAllProjects(req, res) {
    try {
      const userId = req.user.userId;
      const userRole = req.user.fullUser.role_nom;
      const { search, status } = req.query;

      let projects;
      if (search) {
        projects = await Project.search(search, userId, userRole);
      } else if (status) {
        projects = await Project.getByStatus(status, userId, userRole);
      } else {
        projects = await Project.findAll(userId, userRole);
      }

      // Log pour audit
      console.log(`📋 ${projects.length} projets récupérés par ${req.user.email} (${userRole})`);

      res.json({
        success: true,
        data: projects,
        count: projects.length,
        user_role: userRole,
        message: `${projects.length} projets trouvés`
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des projets:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la récupération des projets'
      });
    }
  }

  // Récupérer un projet par ID
  static async getProjectById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.fullUser.role_nom;

      const project = await Project.findById(id, userId, userRole);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Projet non trouvé ou accès non autorisé',
          user_role: userRole
        });
      }

      res.json({
        success: true,
        data: project
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du projet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }

  // Créer un nouveau projet (Admin et PMO seulement)
  static async createProject(req, res) {
    try {
      const userRole = req.user.fullUser.role_nom;
      
      // Vérifier les permissions de création
      if (!['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Seuls les administrateurs et PMO peuvent créer des projets',
          user_role: userRole,
          required_roles: ['Administrateur fonctionnel', 'PMO / Directeur de projets']
        });
      }

      const { nom, description, chef_projet_id, direction_id, statut_id, budget, date_debut, date_fin_prevue, priorite } = req.body;

      // Validation des données
      if (!nom || !chef_projet_id || !direction_id || !statut_id) {
        return res.status(400).json({
          success: false,
          message: 'Les champs nom, chef_projet_id, direction_id et statut_id sont requis'
        });
      }

      const projectData = {
        nom,
        description,
        chef_projet_id: parseInt(chef_projet_id),
        direction_id: parseInt(direction_id),
        statut_id: parseInt(statut_id),
        budget: budget ? parseFloat(budget) : null,
        date_debut,
        date_fin_prevue,
        priorite
      };

      const projectId = await Project.create(projectData);

      // Log pour audit
      console.log(`✅ Nouveau projet créé par ${req.user.email}: "${nom}" (ID: ${projectId})`);

      res.status(201).json({
        success: true,
        message: 'Projet créé avec succès',
        data: { id: projectId }
      });

    } catch (error) {
      console.error('Erreur lors de la création du projet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de la création'
      });
    }
  }

  // Mettre à jour un projet
  static async updateProject(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.fullUser.role_nom;
      const updateData = req.body;

      // Vérifier si le projet existe et si l'utilisateur peut le modifier
      const project = await Project.findById(id, userId, userRole);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Projet non trouvé ou accès non autorisé'
        });
      }

      // Vérifier les permissions de modification
      if (!Project.canModify(project, userId, userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'avez pas les permissions pour modifier ce projet',
          user_role: userRole,
          project_chef: project.chef_projet_nom
        });
      }

      // Mettre à jour
      const updated = await Project.update(id, updateData, userId, userRole);
      if (!updated) {
        return res.status(400).json({
          success: false,
          message: 'Aucune modification apportée'
        });
      }

      // Log pour audit
      console.log(`✅ Projet "${project.nom}" mis à jour par ${req.user.email}`);

      res.json({
        success: true,
        message: 'Projet mis à jour avec succès'
      });

    } catch (error) {
      console.error('Erreur lors de la mise à jour du projet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }

  // Supprimer un projet (Admin et PMO seulement)
  static async deleteProject(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.userId;
      const userRole = req.user.fullUser.role_nom;

      // Vérifier les permissions de suppression
      if (!['Administrateur fonctionnel', 'PMO / Directeur de projets'].includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: 'Seuls les administrateurs et PMO peuvent supprimer des projets',
          user_role: userRole
        });
      }

      // Vérifier si le projet existe
      const project = await Project.findById(id, userId, userRole);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Projet non trouvé'
        });
      }

      // Supprimer
      const deleted = await Project.delete(id, userId, userRole);
      if (!deleted) {
        return res.status(400).json({
          success: false,
          message: 'Erreur lors de la suppression'
        });
      }

      // Log pour audit
      console.log(`⚠️ Projet "${project.nom}" supprimé par ${req.user.email}`);

      res.json({
        success: true,
        message: 'Projet supprimé avec succès'
      });

    } catch (error) {
      console.error('Erreur lors de la suppression du projet:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }

  // Statistiques des projets
  static async getProjectStats(req, res) {
    try {
      const userId = req.user.userId;
      const userRole = req.user.fullUser.role_nom;

      const stats = await Project.getStats(userId, userRole);

      res.json({
        success: true,
        data: stats,
        user_role: userRole
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }

  // Projets récents
  static async getRecentProjects(req, res) {
    try {
      const userId = req.user.userId;
      const userRole = req.user.fullUser.role_nom;
      const limit = parseInt(req.query.limit) || 5;

      const projects = await Project.getRecent(limit, userId, userRole);

      res.json({
        success: true,
        data: projects,
        count: projects.length
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des projets récents:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }

  // Tableau de bord des projets pour l'utilisateur connecté
  static async getDashboard(req, res) {
    try {
      const userId = req.user.userId;
      const userRole = req.user.fullUser.role_nom;

      // Récupérer différentes métriques
      const [stats, recentProjects, myProjects] = await Promise.all([
        Project.getStats(userId, userRole),
        Project.getRecent(5, userId, userRole),
        userRole === 'Chef de Projet' ? Project.findAll(userId, userRole) : []
      ]);

      res.json({
        success: true,
        data: {
          stats,
          recent_projects: recentProjects,
          my_projects: myProjects,
          user_role: userRole
        }
      });

    } catch (error) {
      console.error('Erreur lors de la récupération du dashboard:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur'
      });
    }
  }
}

module.exports = ProjectController;