import { defineConfig } from '@soybeanjs/eslint-config-vue';

export default defineConfig({
  'vue/component-name-in-template-casing': [
    'warn',
    'PascalCase',
    {
      registeredComponentsOnly: false,
      ignores: ['/^icon-/']
    }
  ],
  'no-underscore-dangle': [
    'error',
    {
      allow: ['_router', '_controller', '_isCreating', '_handleClose', '_handleDelete', '_addBtnMenu', '_handleUpdateBtnMenu', '_deployEnvOptions', '_toggleInitMode', '_hasMediaSection', '_spaceRight', '_hasPutPermission', '_hasDeletePermission', '_currentList']
    }
  ]
});
