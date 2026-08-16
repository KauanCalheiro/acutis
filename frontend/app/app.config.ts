export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'neutral'
    },
    button: {
      slots: {
        base: 'group',
        trailingIcon: 'transition-transform duration-200 group-data-[state=open]:rotate-180'
      },
      defaultVariants: {
        size: 'xl'
      },
      compoundVariants: [
        {
          color: 'neutral',
          variant: 'soft',
          class: 'bg-accented/75 hover:bg-accented active:bg-accented'
        }
      ]
    },
    badge: {
      defaultVariants: {
        size: 'lg',
        variant: 'soft'
      }
    },
    kbd: {
      defaultVariants: {
        size: 'xl'
      }
    },
    tooltip: {
      slots: {
        text: 'text-base'
      }
    },
    alert: {
      defaultVariants: {
        variant: 'soft'
      }
    },
    card: {
      defaultVariants: {
        variant: 'soft'
      },
      variants: {
        variant: {
          soft: {
            root: 'bg-elevated divide-y divide-default'
          }
        }
      }
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
