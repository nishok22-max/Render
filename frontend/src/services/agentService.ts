import api from './api';
import { useAgentStore, type AgentInfo } from '../store/agentStore';

export const agentService = {
  /**
   * Fetch all agents from the backend and update the store.
   */
  async fetchAgents(): Promise<AgentInfo[]> {
    try {
      const { data } = await api.get('/agents');
      const agents: AgentInfo[] = data.agents;
      
      // Update the global store
      useAgentStore.getState().setAgents(agents);
      
      console.log('[AgentService] Successfully fetched agents:', agents.length);
      return agents;
    } catch (error) {
      console.error('[AgentService] Failed to fetch agents:', error);
      return [];
    }
  },

  /**
   * Update a specific agent's status (convenience method)
   */
  async updateAgentStatus(id: string, status: AgentInfo['status']) {
    useAgentStore.getState().updateAgent(id, { status });
  }
};
