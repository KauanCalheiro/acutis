export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'neutral'
    },
    button: {
      defaultVariants: {
        size: 'xl',
      },
    },
    badge: {
      defaultVariants: {
        size: 'xl',
        variant: 'soft'
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'soft',
          class: 'bg-primary/25'
        },
        {
          color: 'secondary',
          variant: 'soft',
          class: 'bg-secondary/25'
        },
        {
          color: 'success',
          variant: 'soft',
          class: 'bg-success/25'
        },
        {
          color: 'info',
          variant: 'soft',
          class: 'bg-info/25'
        },
        {
          color: 'warning',
          variant: 'soft',
          class: 'bg-warning/25'
        },
        {
          color: 'error',
          variant: 'soft',
          class: 'bg-error/25'
        }
      ]
    },
    kbd: {
      defaultVariants: {
        size: 'xl',
        variant: 'soft'
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'soft',
          class: 'bg-primary/25'
        },
        {
          color: 'secondary',
          variant: 'soft',
          class: 'bg-secondary/25'
        },
        {
          color: 'success',
          variant: 'soft',
          class: 'bg-success/25'
        },
        {
          color: 'info',
          variant: 'soft',
          class: 'bg-info/25'
        },
        {
          color: 'warning',
          variant: 'soft',
          class: 'bg-warning/25'
        },
        {
          color: 'error',
          variant: 'soft',
          class: 'bg-error/25'
        }
      ]
    },
    alert: {
      defaultVariants: {
        variant: 'soft'
      },
      compoundVariants: [
        {
          color: 'primary',
          variant: 'soft',
          class: {
            root: 'bg-primary/25'
          }
        },
        {
          color: 'secondary',
          variant: 'soft',
          class: {
            root: 'bg-secondary/25'
          }
        },
        {
          color: 'success',
          variant: 'soft',
          class: {
            root: 'bg-success/25'
          }
        },
        {
          color: 'info',
          variant: 'soft',
          class: {
            root: 'bg-info/25'
          }
        },
        {
          color: 'warning',
          variant: 'soft',
          class: {
            root: 'bg-warning/25'
          }
        },
        {
          color: 'error',
          variant: 'soft',
          class: {
            root: 'bg-error/25'
          }
        }
      ]
    },
    input: {
      defaultVariants: {
        size: 'xl',
        variant: 'soft'
      },
      variants: {
        variant: {
          soft: 'text-highlighted bg-elevated hover:bg-accented/75 focus:bg-accented/75 disabled:bg-elevated/70'
        }
      }
    },
    textarea: {
      defaultVariants: {
        size: 'xl',
        variant: 'soft'
      },
      variants: {
        variant: {
          soft: 'text-highlighted bg-elevated hover:bg-accented/75 focus:bg-accented/75 disabled:bg-elevated/70'
        }
      }
    },
    select: {
      defaultVariants: {
        size: 'xl',
        variant: 'soft'
      },
      variants: {
        variant: {
          soft: 'text-highlighted bg-elevated hover:bg-accented/75 focus:bg-accented/75 disabled:bg-elevated/70'
        }
      }
    },
    selectMenu: {
      defaultVariants: {
        size: 'xl',
        variant: 'soft'
      },
      variants: {
        variant: {
          soft: 'text-highlighted bg-elevated hover:bg-accented/75 focus:bg-accented/75 disabled:bg-elevated/70'
        }
      }
    },
    inputMenu: {
      defaultVariants: {
        size: 'xl',
        variant: 'soft'
      },
      variants: {
        variant: {
          soft: 'text-highlighted bg-elevated hover:bg-accented/75 focus:bg-accented/75 disabled:bg-elevated/70'
        }
      }
    },
    inputNumber: {
      defaultVariants: {
        size: 'xl',
        variant: 'soft'
      },
      variants: {
        variant: {
          soft: 'text-highlighted bg-elevated hover:bg-accented/75 focus:bg-accented/75 disabled:bg-elevated/70'
        }
      }
    },
    inputTags: {
      defaultVariants: {
        size: 'xl',
        variant: 'soft'
      },
      variants: {
        variant: {
          soft: 'text-highlighted bg-elevated hover:bg-accented/75 focus:bg-accented/75 disabled:bg-elevated/70'
        }
      }
    },
    checkbox: {
      defaultVariants: {
        size: 'xl'
      }
    },
    radioGroup: {
      defaultVariants: {
        size: 'xl'
      }
    },
    switch: {
      defaultVariants: {
        size: 'xl'
      }
    },
    avatar: {
      defaultVariants: {
        size: 'xl'
      }
    },
    chip: {
      defaultVariants: {
        size: 'xl'
      }
    }
  }
})
