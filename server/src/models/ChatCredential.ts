import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../storage/db';

/**
 * ChatCredential model for storing encrypted web login credentials
 * for chat providers (k2think, qwen, deepseek, grok, z.ai, mistral)
 */

interface ChatCredentialAttributes {
  id: string;
  userId?: number; // Optional: if multi-tenant, associate with user
  provider: string; // 'k2think' | 'qwen' | 'deepseek' | 'grok' | 'zai' | 'mistral'
  email: string;
  encryptedPassword: string; // AES-256 encrypted
  active: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ChatCredentialCreationAttributes extends Optional<ChatCredentialAttributes, 'id' | 'userId' | 'lastUsedAt' | 'createdAt' | 'updatedAt'> {}

class ChatCredential extends Model<ChatCredentialAttributes, ChatCredentialCreationAttributes> implements ChatCredentialAttributes {
  public id!: string;
  public userId!: number;
  public provider!: string;
  public email!: string;
  public encryptedPassword!: string;
  public active!: boolean;
  public lastUsedAt!: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ChatCredential.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['k2think', 'qwen', 'deepseek', 'grok', 'zai', 'mistral']],
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    encryptedPassword: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'chat_credentials',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['provider', 'email'],
      },
    ],
  }
);

export default ChatCredential;

