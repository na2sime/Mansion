import { Request, Response } from 'express';
import { UserService } from '../services/this.userService';
import { AuthRequest } from '@mansion/common';

export class UserController {
  constructor(private this.userService: UserService) {}
  // @ts-ignore
  async createProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { publicKey } = req.body;

      // Check if profile already exists
      const existing = await this.userService.getUserProfile(userId);
      if (existing) {
        return res.status(409).json({ error: 'Profile already exists' });
      }

      const profile = await this.userService.createUserProfile(userId, publicKey);

      res.status(201).json(profile);
    } catch (error: any) {
      console.error('Create profile error:', error);
      res.status(500).json({ error: 'Failed to create profile', message: error.message });
    }
  }

  // @ts-ignore
  async getMyProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;

      const profile = await this.userService.getUserProfile(userId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      res.json(profile);
    } catch (error: any) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile', message: error.message });
    }
  }

  // @ts-ignore
  async updateTag(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { newTag } = req.body;

      await this.userService.updateUserTag(userId, newTag);

      res.json({ message: 'Tag updated successfully', newTag: newTag.toUpperCase() });
    } catch (error: any) {
      if (error.message === 'Invalid tag format. Must be 8 alphanumeric characters + # + max 3 alphanumeric characters') {
        return res.status(400).json({ error: error.message });
      }
      if (error.message === 'Tag already taken') {
        return res.status(409).json({ error: error.message });
      }
      console.error('Update tag error:', error);
      res.status(500).json({ error: 'Failed to update tag', message: error.message });
    }
  }

  async updatePublicKey(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { publicKey } = req.body;

      await this.userService.updatePublicKey(userId, publicKey);

      res.json({ message: 'Public key updated successfully' });
    } catch (error: any) {
      console.error('Update public key error:', error);
      res.status(500).json({ error: 'Failed to update public key', message: error.message });
    }
  }

  // @ts-ignore
  async searchUser(req: Request, res: Response) {
    try {
      const { tag } = req.query;

      if (!tag || typeof tag !== 'string') {
        return res.status(400).json({ error: 'Tag parameter is required' });
      }

      const user = await this.userService.searchUserByTag(tag);

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Return only public information
      res.json({
        id: user.id,
        userTag: user.userTag,
        publicKey: user.publicKey,
      });
    } catch (error: any) {
      console.error('Search user error:', error);
      res.status(500).json({ error: 'Failed to search user', message: error.message });
    }
  }

  // @ts-ignore
  async sendContactRequest(req: AuthRequest, res: Response) {
    try {
      const fromUserId = req.user!.userId;
      const { userTag } = req.body;

      const request = await this.userService.sendContactRequest(fromUserId, userTag);

      res.status(201).json({
        message: 'Contact request sent',
        request,
      });
    } catch (error: any) {
      if (
        error.message === 'User not found' ||
        error.message === 'Cannot add yourself as contact' ||
        error.message === 'Already in contacts' ||
        error.message === 'Contact request already pending'
      ) {
        return res.status(400).json({ error: error.message });
      }
      console.error('Send contact request error:', error);
      res.status(500).json({ error: 'Failed to send contact request', message: error.message });
    }
  }

  async getPendingRequests(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;

      const requests = await this.userService.getPendingContactRequests(userId);

      res.json(requests);
    } catch (error: any) {
      console.error('Get pending requests error:', error);
      res.status(500).json({ error: 'Failed to get pending requests', message: error.message });
    }
  }

  // @ts-ignore
  async respondToRequest(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      const { action, nickname } = req.body;

      await this.userService.respondToContactRequest(requestId, userId, action, nickname);

      res.json({ message: `Contact request ${action}ed successfully` });
    } catch (error: any) {
      if (error.message === 'Contact request not found' || error.message === 'Request already processed') {
        return res.status(400).json({ error: error.message });
      }
      console.error('Respond to request error:', error);
      res.status(500).json({ error: 'Failed to respond to request', message: error.message });
    }
  }

  async getContacts(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;

      const contacts = await this.userService.getContacts(userId);

      res.json(contacts);
    } catch (error: any) {
      console.error('Get contacts error:', error);
      res.status(500).json({ error: 'Failed to get contacts', message: error.message });
    }
  }

  // @ts-ignore
  async removeContact(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.userId;
      const { contactId } = req.params;

      await this.userService.removeContact(userId, contactId);

      res.status(204).send();
    } catch (error: any) {
      if (error.message === 'Contact not found') {
        return res.status(404).json({ error: error.message });
      }
      console.error('Remove contact error:', error);
      res.status(500).json({ error: 'Failed to remove contact', message: error.message });
    }
  }
}
