import React, { useState } from 'react';
import {
  Send,
  Shield,
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  MessageSquare,
  UserCheck,
  User,
  Plus,
} from 'lucide-react';
import { SecureConversation, SecureMessage, AppUser, Patient } from '../types/clinical';

interface SecureMessagingViewProps {
  conversations: SecureConversation[];
  messages: Record<string, SecureMessage[]>;
  currentUser: AppUser;
  patients: Patient[];
  onSendMessage: (conversationId: string, text: string) => void;
  onConvertToFollowUp: (patientId: string, patientName: string, text: string) => void;
  isOnline: boolean;
}

export const SecureMessagingView: React.FC<SecureMessagingViewProps> = ({
  conversations,
  messages,
  currentUser,
  patients,
  onSendMessage,
  onConvertToFollowUp,
  isOnline,
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string>(conversations[0]?.id || '');
  const [inputText, setInputText] = useState('');

  const activeConv = conversations.find((c) => c.id === selectedConvId) || conversations[0];
  const activeMessages = activeConv ? messages[activeConv.id] || [] : [];

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConv) return;
    onSendMessage(activeConv.id, inputText.trim());
    setInputText('');
  };

  return (
    <div className="grid grid-cols-12 gap-5 h-[calc(100vh-140px)]">
      {/* Left List of Conversations */}
      <div className="col-span-12 lg:col-span-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-clinical flex flex-col transition-colors">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Messagerie Sécurisée Patient
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-semibold tabular-nums">
            {conversations.length} fil(s)
          </span>
        </div>

        <div className="space-y-1.5 flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const isSelected = conv.id === activeConv?.id;
            return (
              <div
                key={conv.id}
                onClick={() => setSelectedConvId(conv.id)}
                className={`p-3.5 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {conv.patientName}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    {new Date(conv.lastMessageAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-700 dark:text-slate-300 font-medium truncate">
                  {conv.subject}
                </p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Avec : {conv.practitionerName}
                  </span>
                  <span
                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                      conv.status === 'open'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {conv.status === 'open' ? 'Ouvert' : 'En attente'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Chat Thread */}
      <div className="col-span-12 lg:col-span-8 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-clinical flex flex-col overflow-hidden transition-colors">
        {activeConv ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-3.5 bg-slate-50/70 dark:bg-slate-800/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeConv.patientName}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-400">· {activeConv.subject}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Praticien référent : {activeConv.practitionerName}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                  Chiffrement de bout en bout
                </span>
              </div>
            </div>

            {/* Disclaimer d'Urgence */}
            <div className="bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 px-5 py-2 flex items-center gap-2 text-[11px] text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                <strong>Avis réglementaire :</strong> Ce canal sécurisé ne traite pas les urgences médicales. En cas d'urgence vitale, composez immédiatement le 15 ou le 112. Délai de réponse moyen du cabinet : sous 48h ouvrées.
              </span>
            </div>

            {/* Messages timeline */}
            <div className="flex-1 p-5 space-y-4 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/30">
              {activeMessages.map((msg) => {
                const isDoctor = msg.senderType === 'doctor';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isDoctor ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-1 px-1">
                      <span className="font-semibold text-slate-900 dark:text-slate-200">{msg.senderName}</span>
                      <span>·</span>
                      <span className="tabular-nums">{new Date(msg.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-2xs leading-relaxed ${
                        isDoctor
                          ? 'bg-blue-600 text-white rounded-br-xs'
                          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-xs'
                      }`}
                    >
                      <p>{msg.body}</p>
                    </div>

                    {/* Statuts & Actions */}
                    <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-500 dark:text-slate-400">
                      {isDoctor && (
                        <span className="flex items-center gap-1">
                          {msg.status === 'queued' ? (
                            <>
                              <Clock className="h-3 w-3 text-amber-500" />
                              <span>En attente de connexion</span>
                            </>
                          ) : msg.status === 'delivered' ? (
                            <>
                              <CheckCheck className="h-3 w-3 text-slate-400" />
                              <span>Délivré</span>
                            </>
                          ) : (
                            <>
                              <CheckCheck className="h-3 w-3 text-blue-500" />
                              <span>Lu</span>
                            </>
                          )}
                        </span>
                      )}

                      {!isDoctor && currentUser.role === 'doctor' && (
                        <button
                          type="button"
                          onClick={() =>
                            onConvertToFollowUp(
                              activeConv.patientId,
                              activeConv.patientName,
                              msg.body
                            )
                          }
                          className="hover:text-blue-600 dark:hover:text-blue-400 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <UserCheck className="h-3 w-3" />
                          <span>Créer un rappel / suivi</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Composer */}
            <form
              onSubmit={handleSend}
              className="border-t border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-900 flex items-center gap-3"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Rédiger une réponse médicale sécurisée..."
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed shadow-xs transition-colors cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Envoyer</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400">
            Sélectionnez une conversation pour afficher le fil sécurisé.
          </div>
        )}
      </div>
    </div>
  );
};
